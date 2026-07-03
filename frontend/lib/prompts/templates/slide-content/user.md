# Generation Requirements

## Scene Information

- **Title**: {{title}}
- **Description**: {{description}}
- **Key Points**:
  {{keyPoints}}

{{teacherContext}}

{{courseContext}}

{{agents}}

{{userProfile}}

## Available Resources

{{#if mediaElementEnabled}}
- **Available Media**: {{assignedImages}}
{{/if}}
- **Canvas Size**: {{canvas_width}} × {{canvas_height}} px

## Output Requirements

Based on the scene information above, generate a complete Canvas/PPT component for one page, **including the teaching action sequence** in the same JSON.

## Language Directive
{{languageDirective}}

**Must Follow**:

1. Output pure JSON directly, without any explanation or description
2. Do not wrap with ```json code blocks
3. Do not add any text before or after the JSON
4. Ensure the JSON format is correct and can be parsed directly
{{#if imageElementEnabled}}
- Use only the provided image IDs (for example, `img_1`) for source image `src` fields
{{/if}}
{{#if generatedVideoEnabled}}
- Use only the provided generated video media refs for video `mediaRef` fields
{{/if}}
5. All TextElement `height` values must be selected from the quick reference table in the system prompt
6. The top-level JSON MUST include all three keys: `background`, `elements`, AND `actions`
7. `actions` is an array (5–10 items) of `{"type":"action",...}` and `{"type":"text",...}` objects that references the `id`s you put in `elements`. See the system prompt's "Teaching Action Sequence" section for full rules.

**Output Structure Example**:
{"background":{"type":"solid","color":"#ffffff"},"elements":[{"id":"title_001","type":"text","left":60,"top":50,"width":880,"height":76,"content":"<p style=\"font-size:32px;\"><strong>Title Content</strong></p>","defaultFontName":"","defaultColor":"#333333"},{"id":"content_001","type":"text","left":60,"top":150,"width":880,"height":130,"content":"<p style=\"font-size:18px;\">• Point One</p><p style=\"font-size:18px;\">• Point Two</p><p style=\"font-size:18px;\">• Point Three</p>","defaultFontName":"","defaultColor":"#333333"}],"actions":[{"type":"action","name":"spotlight","params":{"elementId":"title_001"}},{"type":"text","content":"First, let's look at the title."},{"type":"action","name":"spotlight","params":{"elementId":"content_001"}},{"type":"text","content":"Here are the three key points we just discussed."}]}
