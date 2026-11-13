from importlib import import_module

from app.config import GROQ_API_KEY, GROQ_MODEL


def test_groq_connection():
    if not GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is missing. Check your .env file."
        )

    try:
        Groq = import_module("groq").Groq
    except ModuleNotFoundError as exc:
        if exc.name == "groq":
            raise RuntimeError(
                "The 'groq' package is not installed. Install it with 'pip install groq'."
            ) from exc
        raise

    client = Groq(api_key=GROQ_API_KEY)

    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful AI assistant.",
            },
            {
                "role": "user",
                "content": "Explain c# in two sentences.",
            },
        ],
    )

    response = completion.choices[0].message.content

    if not response:
        raise RuntimeError("The LLM returned an empty response.")

    print("Groq API connection successful!")
    print("\nLLM response:\n")
    print(response)


if __name__ == "__main__":
    test_groq_connection()