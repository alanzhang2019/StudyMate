export function extractTopicFromRequirement(requirement: string): string {
  const trimmed = requirement.trim();
  if (trimmed.length <= 500) {
    return trimmed;
  }
  return `${trimmed.substring(0, 500).trim()}...`;
}

export function buildInitialStageName(input: {
  requirement: string;
  mistakeSessionId?: string;
}): string {
  if (input.mistakeSessionId) {
    return '题目讲解';
  }

  return extractTopicFromRequirement(input.requirement);
}
