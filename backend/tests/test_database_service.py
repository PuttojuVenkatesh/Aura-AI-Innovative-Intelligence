import sqlite3
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app import main
from app.schemas.ingestion import IngestionResult
from app.services import database_service


def test_initialize_and_save_chat_exchange(tmp_path, monkeypatch):
    database_path = tmp_path / "data" / "chat.db"
    monkeypatch.setattr(database_service, "db_path", database_path)
    monkeypatch.setattr(database_service, "USE_POSTGRES", False)

    database_service.initialize_database()
    database_service.add_chat_exchange("session-1", "Hello", "Hi there.")

    assert database_path.exists()
    assert database_service.get_chat_history("session-1") == [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there."},
    ]

    with sqlite3.connect(database_path) as connection:
        row = connection.execute(
            "SELECT title FROM conversations WHERE id = ?",
            ("session-1",),
        ).fetchone()
    assert row == ("Hello",)


def test_analyze_route_persists_conversation(tmp_path, monkeypatch):
    database_path = tmp_path / "chat.db"
    monkeypatch.setattr(database_service, "db_path", database_path)
    monkeypatch.setattr(database_service, "USE_POSTGRES", False)
    monkeypatch.setattr(
        main,
        "analyze_message",
        lambda message: IngestionResult(
            intent="general_question",
            risk_profile="low",
            priority="low",
            required_action=False,
            summary=message,
        ),
    )
    monkeypatch.setattr(main, "generate_response", lambda result, **kwargs: "Hello from the assistant.")

    with TestClient(main.app) as client:
        response = client.post(
            "/api/analyze",
            json={"session_id": "route-session", "message": "Hello"},
        )

    assert response.status_code == 200
    assert response.json()["session_id"] == "route-session"
    assert database_service.get_chat_history("route-session") == [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hello from the assistant."},
    ]
    assert client.get("/api/conversations").json()[0]["session_id"] == "route-session"
    saved_messages = client.get("/api/conversations/route-session/messages").json()
    assert saved_messages[-1]["metadata"]["intent"] == "general_question"


def test_stream_route_persists_chat_and_metadata(tmp_path, monkeypatch):
    database_path = tmp_path / "chat.db"
    monkeypatch.setattr(database_service, "db_path", database_path)
    monkeypatch.setattr(database_service, "USE_POSTGRES", False)
    monkeypatch.setattr(
        main,
        "analyze_message",
        lambda message: IngestionResult(
            intent="general_question",
            risk_profile="low",
            priority="medium",
            required_action=False,
            summary=message,
        ),
    )
    monkeypatch.setattr(main, "stream_response", lambda *args, **kwargs: iter(["Hello", " there."]))

    with TestClient(main.app) as client:
        response = client.post(
            "/api/analyze/stream",
            json={"session_id": "stream-session", "message": "Hello"},
        )

    assert response.status_code == 200
    assert '"content": "Hello"' in response.text
    assert '"content": " there."' in response.text
    assert database_service.get_chat_history("stream-session") == [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hello there."},
    ]
    saved_messages = database_service.get_conversation_messages("stream-session")
    assert saved_messages[-1]["metadata"]["priority"] == "medium"


def test_incognito_stream_uses_client_history_without_saving(tmp_path, monkeypatch):
    database_path = tmp_path / "chat.db"
    monkeypatch.setattr(database_service, "db_path", database_path)
    monkeypatch.setattr(database_service, "USE_POSTGRES", False)
    monkeypatch.setattr(
        main,
        "analyze_message",
        lambda message: IngestionResult(
            intent="general_question",
            risk_profile="low",
            priority="low",
            required_action=False,
            summary=message,
        ),
    )
    captured = {}

    def fake_stream(*args, **kwargs):
        captured.update(kwargs)
        return iter(["Private reply."])

    monkeypatch.setattr(main, "stream_response", fake_stream)

    with TestClient(main.app) as client:
        response = client.post(
            "/api/analyze/stream",
            json={
                "session_id": "incognito-session",
                "message": "Follow up",
                "incognito": True,
                "history": [
                    {"role": "user", "content": "Earlier question"},
                    {"role": "assistant", "content": "Earlier answer"},
                ],
            },
        )

    assert response.status_code == 200
    assert captured["history"] == [
        {"role": "user", "content": "Earlier question"},
        {"role": "assistant", "content": "Earlier answer"},
    ]
    assert database_service.get_chat_history("incognito-session") == []
    assert client.get("/api/conversations").json() == []


def test_archive_restore_and_expiration_endpoints(tmp_path, monkeypatch):
    database_path = tmp_path / "chat.db"
    monkeypatch.setattr(database_service, "db_path", database_path)
    monkeypatch.setattr(database_service, "USE_POSTGRES", False)
    database_service.initialize_database()
    database_service.add_chat_exchange("archive-session", "Hello", "Hi there.")

    with TestClient(main.app) as client:
        archived = client.post("/api/conversations/archive-session/archive")
        assert archived.status_code == 200
        archive_list = client.get("/api/conversations/archived")
        assert archive_list.status_code == 200
        assert archive_list.json()[0]["session_id"] == "archive-session"

        restored = client.post("/api/conversations/archive-session/restore")
        assert restored.status_code == 200
        assert client.get("/api/conversations/archived").json() == []
        assert client.get("/api/conversations").json()[0]["session_id"] == "archive-session"

        client.post("/api/conversations/archive-session/archive")
        expired = (datetime.now(timezone.utc) - timedelta(days=31)).isoformat()
        with sqlite3.connect(database_path) as connection:
            connection.execute(
                "UPDATE conversations SET archived_at = ? WHERE id = ?",
                (expired, "archive-session"),
            )
        assert client.get("/api/conversations/archived").json() == []
        assert database_service.get_conversation_messages("archive-session") == []


def test_delete_conversation_endpoint_removes_chat_and_messages(tmp_path, monkeypatch):
    database_path = tmp_path / "chat.db"
    monkeypatch.setattr(database_service, "db_path", database_path)
    monkeypatch.setattr(database_service, "USE_POSTGRES", False)
    database_service.initialize_database()
    database_service.add_chat_exchange("delete-session", "Hello", "Hi there.")

    with TestClient(main.app) as client:
        response = client.delete("/api/conversations/delete-session")
        assert response.status_code == 200
        assert response.json() == {"status": "deleted"}
        assert client.get("/api/conversations").json() == []
        assert client.get("/api/conversations/delete-session/messages").json() == []
        assert client.delete("/api/conversations/delete-session").status_code == 404
