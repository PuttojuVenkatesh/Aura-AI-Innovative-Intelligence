from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

intent=Literal[
    "greeting",
    "order_tracking",
    "payment_issue",
    "current_time",
    "general_question",
    "unknown",
]

RiskProfile=Literal["low","medium","high","unknown"]
priority=Literal["low","medium","high"]

class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=5000)

class IngestionRequest(BaseModel):
    model_config= ConfigDict(extra="forbid")
    session_id: str | None=Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Optional conversation session identifier"
    )

    incognito: bool = False
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=12)

    message: str=Field(
        min_length=1,
        max_length=5000,
        description="user's original message",
        examples=["where is my order?"]    
    )


    @field_validator("message")
    @classmethod
    def message_must_not_be_blanck(cls, value:str) ->str:
        value = value.strip()
        if not value:
            raise ValueError("message must not be blank")
        return value

class TokenMetadata(BaseModel):
    estimated_input_tokens: int=Field(default=0, ge=0)
    note: str="Estimating the number of tokens in the input message."

class IngestionResult(BaseModel):
    model_config=ConfigDict(extra="forbid")

    intent: intent
    risk_profile: RiskProfile
    priority: priority
    required_action: bool
    summary: str=Field(min_length=1, max_length=1000)
    token_metadata: TokenMetadata=Field(default_factory=TokenMetadata)