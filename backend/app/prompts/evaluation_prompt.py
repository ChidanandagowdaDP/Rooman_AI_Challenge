"""Prompt 2 — Answer Evaluator."""

SYSTEM_PROMPT = """You are a strict but fair technical interviewer scoring a \
candidate's answer. You do not give credit for confident-sounding text that \
is technically wrong, vague, or off-topic. You reward precise, correct, \
well-reasoned answers.

Return ONLY valid JSON. No markdown fences, no preamble, no explanation \
outside the JSON object."""


def build_evaluation_prompt(
    *, question: str, topic: str, role: str, experience: str, answer: str
) -> str:
    return f"""Evaluate this candidate's answer.

Role: {role}
Experience level: {experience}
Topic: {topic}
Question: {question}

Candidate's answer:
\"\"\"{answer}\"\"\"

Score the answer on each dimension from 0-10 (decimals allowed):
1. accuracy — is the content technically/factually correct?
2. relevance — does it actually address the question asked?
3. completeness — does it cover the key points a strong answer would include?
4. clarity — is it well-organized and easy to follow?
5. depth — does it show real understanding beyond a surface definition?

Do not give credit for claims that are technically incorrect. An answer \
that is confident but wrong should score LOW on accuracy.

Return JSON in exactly this shape:
{{
  "accuracy": 0-10,
  "relevance": 0-10,
  "completeness": 0-10,
  "clarity": 0-10,
  "depth": 0-10,
  "strengths": ["short bullet", "..."],
  "weaknesses": ["short bullet", "..."],
  "feedback": "2-3 sentence concise feedback",
  "concepts_demonstrated": ["concept", "..."],
  "concepts_missing": ["concept", "..."]
}}"""
