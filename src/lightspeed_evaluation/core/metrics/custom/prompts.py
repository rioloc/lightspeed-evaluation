"""Prompts for custom metrics evaluation."""

# pylint: disable=line-too-long

# Answer Correctness Evaluation Prompt
ANSWER_CORRECTNESS_PROMPT = """Evaluate the answer correctness of the given response.

Question: {query}
Response: {response}
Expected Response: {expected_response}

Consider:
- Factual accuracy compared to expected response
- Completeness of information
- Alignment with expected response
- Absence of contradictory information

Rate the answer correctness and provide your reasoning.

Format your response as:
Score: [your score on a scale of 0.0 to 1.0]
Reason: [your detailed explanation]"""

# Intent Evaluation Prompt
INTENT_EVALUATION_PROMPT = """Evaluate whether the response demonstrates the expected intent or purpose.

Question: {query}
Response: {response}
Expected Intent: {expected_intent}

Consider:
- What is the intent/purpose of the actual response?
- Does the response's intent match the expected intent?
- Is the response trying to achieve what is described in the expected intent?

Examples of intent evaluation:
- If expected intent is "provide instructions", check if the response is instructional
- If expected intent is "explain a concept", check if the response is explanatory  
- If expected intent is "refuse or decline", check if the response is declining to help
- If expected intent is "ask for clarification", check if the response is asking questions

Rate the intent alignment and provide your reasoning. Use binary scoring: 1 for match, 0 for no match.

Format your response as:
Score: [0 or 1]
Reason: [your detailed explanation]"""

# Proposal Evaluation Correctness Prompt
PROPOSAL_EVALUATION_CORRECTNESS_PROMPT = """Evaluate the quality of this agentic remediation workflow.

## Original Request
{request}

## Workflow Summary
{workflow_summary}

Evaluate the following aspects and provide an overall quality score:

1. **Diagnosis Quality**: Is the root cause analysis accurate and well-reasoned?
   Does it correctly identify the problem? Is the confidence level appropriate?
2. **Option Selection**: If multiple options were proposed, was the approved option
   (Option 0) the most appropriate choice? Were alternatives reasonable?
3. **Action Appropriateness**: Are the proposed/executed actions appropriate for
   the diagnosed issue? Are they safe, well-scoped, and minimal?
4. **Risk Management**: Is the risk assessment accurate? Are rollback plans adequate?
   Is the reversibility assessment correct?
5. **Verification Thoroughness**: Are verification checks comprehensive and relevant?
   Do they adequately confirm the fix?

Note: Only evaluate the aspects that are present in the workflow.
If only analysis was performed, evaluate only diagnosis quality and option planning.
If execution was performed without verification, evaluate diagnosis and execution quality.
The analysis may contain multiple remediation options — Option 0 is the one that was
auto-approved and executed.

Rate the overall quality and provide your reasoning.

Format your response as:
Score: [your score on a scale of 0.0 to 1.0]
Reason: [your detailed explanation]"""
