
import re


def estimate_tokens(text: str) -> int:
    """Estimate the number of tokens in a text string."""
    if not text:
        return 0

    # Approximate token count for English text.
    return len(re.findall(r"\w+|[^\w\s]", text))


def record_usage(
    target: dict | None,
    provider_usage: object | None,
    prompt_text: str,
    completion_text: str,
) -> None:
    if target is None:
        return

    def get_count(name: str, fallback_text: str) -> int:
        value = (
            provider_usage.get(name)
            if isinstance(provider_usage, dict)
            else getattr(provider_usage, name, None)
        )
        return value if isinstance(value, int) and value >= 0 else estimate_tokens(fallback_text)

    target["prompt_tokens"] = get_count("prompt_tokens", prompt_text)
    target["completion_tokens"] = get_count("completion_tokens", completion_text)
