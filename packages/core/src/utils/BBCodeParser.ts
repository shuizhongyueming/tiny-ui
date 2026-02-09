export interface BBCodeTag {
  name: string;
  value?: string;
}

export interface ParsedSegment {
  text: string;
  tags: BBCodeTag[];
}

interface TagInstance {
  name: string;
  value?: string;
  startIndex: number;
}

interface SegmentBuilder {
  text: string;
  tags: BBCodeTag[];
  startIndex: number;
}

export class BBCodeParser {
  private static readonly MAX_NESTING_DEPTH = 50;

  parse(input: string): ParsedSegment[] {
    const processedInput = this.processEscapes(input);
    return this.parseInternal(processedInput);
  }

  private processEscapes(input: string): string {
    return input.replace(/\[\[/g, "\x00");
  }

  private parseInternal(input: string): ParsedSegment[] {
    const segments: SegmentBuilder[] = [];
    const tagStack: TagInstance[] = [];

    let currentText = "";
    let currentStartIndex = 0;
    let lastIndex = 0;

    const tagPattern = /\[(\/?)(\w+)(?:=(.*?))?\]/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(input)) !== null) {
      const [fullMatch, slash, name, value] = match;
      const matchIndex = match.index;

      // Add text before tag
      if (matchIndex > lastIndex) {
        if (currentText.length === 0) {
          currentStartIndex = lastIndex;
        }
        currentText += input.slice(lastIndex, matchIndex);
      }

      if (slash) {
        // Closing tag - find the last (most recent) matching tag
        const tagIndex = tagStack.findLastIndex((t) => t.name === name);
        if (tagIndex === -1) {
          // No matching open tag, treat as text
          if (currentText.length === 0) {
            currentStartIndex = matchIndex;
          }
          currentText += fullMatch;
        } else {
          // Push segment before closing tag
          if (currentText.length > 0) {
            segments.push({
              text: currentText.replace(/\x00/g, "["),
              tags: tagStack.map((t) => ({ name: t.name, value: t.value })),
              startIndex: currentStartIndex,
            });
            currentText = "";
          }
          // Remove tag from stack
          tagStack.splice(tagIndex, 1);
        }
      } else {
        // Opening tag
        if (tagStack.length >= BBCodeParser.MAX_NESTING_DEPTH) {
          // Too deep, treat as text
          if (currentText.length === 0) {
            currentStartIndex = matchIndex;
          }
          currentText += fullMatch;
        } else {
          // Push current segment
          if (currentText.length > 0) {
            segments.push({
              text: currentText.replace(/\x00/g, "["),
              tags: tagStack.map((t) => ({ name: t.name, value: t.value })),
              startIndex: currentStartIndex,
            });
            currentText = "";
          }
          // Push new tag onto stack
          tagStack.push({
            name,
            value,
            startIndex: matchIndex,
          });
        }
      }

      lastIndex = tagPattern.lastIndex;
    }

    // Handle remaining text
    if (lastIndex < input.length) {
      if (currentText.length === 0) {
        currentStartIndex = lastIndex;
      }
      currentText += input.slice(lastIndex);
    }

    // If there are unclosed tags, we need to merge everything back
    if (tagStack.length > 0) {
      // Find the earliest unclosed tag
      const earliestUnclosed = tagStack.reduce((min, tag) =>
        tag.startIndex < min.startIndex ? tag : min
      );

      // Get segments before the unclosed tag
      const validSegments = segments.filter(
        (s) => s.startIndex < earliestUnclosed.startIndex
      );

      // Get text from earliest unclosed tag to end
      const plainText = input.slice(earliestUnclosed.startIndex);

      validSegments.push({
        text: plainText.replace(/\x00/g, "["),
        tags: [],
        startIndex: earliestUnclosed.startIndex,
      });

      return validSegments.map((s) => ({ text: s.text, tags: s.tags }));
    }

    // Push final segment if any
    if (currentText.length > 0) {
      segments.push({
        text: currentText.replace(/\x00/g, "["),
        tags: tagStack.map((t) => ({ name: t.name, value: t.value })),
        startIndex: currentStartIndex,
      });
    }

    return segments.map((s) => ({ text: s.text, tags: s.tags }));
  }
}
