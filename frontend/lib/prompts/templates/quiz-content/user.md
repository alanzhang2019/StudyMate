Title: {{title}}
Description: {{description}}
Test Points: {{keyPoints}}
Question Count: {{questionCount}}, Difficulty: {{difficulty}}, Question Types: {{questionTypes}}

## Language Directive
{{languageDirective}}

## Output Format (REQUIRED)

Output a single JSON object with `questions` and `actions`. Do NOT emit a bare array. No explanations, no code fences. Include the `waitForInteraction` action before any teacher explanation.

Example shape:
{"questions":[{"id":"q1","type":"single","question":"Question text","options":[{"label":"Option A content","value":"A"},{"label":"Option B content","value":"B"},{"label":"Option C content","value":"C"},{"label":"Option D content","value":"D"}],"answer":["A"],"analysis":"Why A is correct...","points":10}],"actions":[{"type":"text","content":"Quick check — take your time."},{"type":"action","name":"waitForInteraction","params":{"interactionType":"quiz_submit"}},{"type":"text","content":"Great, let's go over the answer."}]}
