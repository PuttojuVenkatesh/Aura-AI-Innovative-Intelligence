import json
import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app.schemas.ingestion import IngestionRequest, IngestionResult
from app.schemas.assistant import AssistantResult
from app.services.database_service import (
    archive_conversation,
    add_chat_exchange,
    get_chat_history,
    get_conversation_messages,
    initialize_database,
    list_archived_conversations,
    list_conversations,
    purge_expired_archives,
    restore_conversation,
)
from app.services.llm_services import analyze_message
from app.services.response_service import generate_response, stream_response
from app.utils.token_counter import estimate_tokens

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    purge_expired_archives()
    yield


app = FastAPI(
    title="Enterprise Structured Ingestion Firewall",
    description="Classifies user messages and validates structured AI output.",
    version="1.0.0",
    lifespan=lifespan,
)

# Simple local-development CORS configuration. Restrict this in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Ingestion Firewall API is running"}


@app.post("/api/analyze", response_model=AssistantResult)
def analyze(request: IngestionRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    session_id = request.session_id or str(uuid4())
    try:
        result = analyze_message(message)
        # Add a local estimate for context budgeting. Provider-reported token
        # counts may differ; this is not billed-usage accounting.
        result.token_metadata.estimated_input_tokens = estimate_tokens(message)

        history = (
            [item.model_dump() for item in request.history]
            if request.incognito
            else get_chat_history(session_id)
        )
        response_markdown = generate_response(result, history=history, current_message=message)
    except ValidationError:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "The model response did not pass schema validation.",
                "validation_errors": exc.errors(),
            },
        ) from exc
    except Exception as exc:
        # Keep the response simple; avoid exposing secrets or internal details.
        raise HTTPException(
            status_code=502,
            detail="LLM request failed. Check the API key, model name, network, and provider limits.",
        ) from exc

    try:
        if not request.incognito:
            add_chat_exchange(session_id, message, response_markdown, result.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="The response was generated, but the conversation could not be saved.",
        ) from exc

    return AssistantResult(
        **result.model_dump(),
        session_id=session_id,
        response_markdown=response_markdown,
    )


@app.get("/api/conversations")
def conversations():
    return list_conversations()


@app.get("/api/conversations/archived")
def archived_conversations():
    purge_expired_archives()
    return list_archived_conversations()


@app.post("/api/conversations/{session_id}/archive")
def archive_chat(session_id: str):
    if not archive_conversation(session_id):
        raise HTTPException(status_code=404, detail="Conversation not found or already archived.")
    return {"status": "archived"}


@app.post("/api/conversations/{session_id}/restore")
def restore_archived_chat(session_id: str):
    if not restore_conversation(session_id):
        raise HTTPException(status_code=404, detail="Archived conversation not found.")
    return {"status": "restored"}


@app.get("/api/conversations/{session_id}/messages")
def conversation_messages(session_id: str):
    return get_conversation_messages(session_id)


@app.post("/api/analyze/stream")
def analyze_stream(request: IngestionRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    session_id = request.session_id or str(uuid4())

    def events():
        try:
            result = analyze_message(message)
            result.token_metadata.estimated_input_tokens = estimate_tokens(message)
            history = (
                [item.model_dump() for item in request.history]
                if request.incognito
                else get_chat_history(session_id)
            )
            metadata = result.model_dump()
            yield _sse({"type": "metadata", "session_id": session_id, "metadata": metadata})

            usage = {}
            parts = []
            for token in stream_response(
                result,
                history=history,
                current_message=message,
                usage=usage,
            ):
                parts.append(token)
                yield _sse({"type": "token", "content": token})

            answer = "".join(parts).strip()
            if not answer:
                raise ValueError("The assistant returned an empty response.")
            if not request.incognito:
                add_chat_exchange(session_id, message, answer, metadata)
            yield _sse({"type": "done", "session_id": session_id})
        except ValidationError as exc:
            logger.exception("Structured analysis response failed validation.")
            yield _sse({
                "type": "error",
                "message": "The model response did not pass schema validation.",
            })
        except Exception:
            logger.exception("Streaming assistant response failed.")
            yield _sse({
                "type": "error",
                "message": "The assistant couldn't complete this response. Check the backend connection and API configuration, then try again.",
            })

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"