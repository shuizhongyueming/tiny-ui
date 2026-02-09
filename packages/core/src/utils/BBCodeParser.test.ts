import { describe, it, expect, beforeEach } from "vitest";
import { BBCodeParser, type ParsedSegment } from "./BBCodeParser";

describe("BBCodeParser", () => {
  let parser: BBCodeParser;

  beforeEach(() => {
    parser = new BBCodeParser();
  });

  describe("Basic parsing", () => {
    it("should parse plain text without tags", () => {
      const result = parser.parse("Hello World");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello World");
      expect(result[0].tags).toEqual([]);
    });

    it("should parse empty string", () => {
      const result = parser.parse("");
      expect(result).toHaveLength(0);
    });
  });

  describe("Single tags", () => {
    it("should parse bold tag", () => {
      const result = parser.parse("[b]bold text[/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("bold text");
      expect(result[0].tags).toEqual([{ name: "b" }]);
    });

    it("should parse italic tag", () => {
      const result = parser.parse("[i]italic text[/i]");
      expect(result[0].text).toBe("italic text");
      expect(result[0].tags).toEqual([{ name: "i" }]);
    });

    it("should parse underline tag", () => {
      const result = parser.parse("[u]underline text[/u]");
      expect(result[0].text).toBe("underline text");
      expect(result[0].tags).toEqual([{ name: "u" }]);
    });

    it("should parse strikethrough tag", () => {
      const result = parser.parse("[s]strikethrough text[/s]");
      expect(result[0].text).toBe("strikethrough text");
      expect(result[0].tags).toEqual([{ name: "s" }]);
    });

    it("should parse color tag with value", () => {
      const result = parser.parse("[color=#ff0000]red text[/color]");
      expect(result[0].text).toBe("red text");
      expect(result[0].tags).toEqual([{ name: "color", value: "#ff0000" }]);
    });

    it("should parse size tag with value", () => {
      const result = parser.parse("[size=1.5]big text[/size]");
      expect(result[0].text).toBe("big text");
      expect(result[0].tags).toEqual([{ name: "size", value: "1.5" }]);
    });

    it("should parse font tag with value", () => {
      const result = parser.parse('[font=Arial]arial text[/font]');
      expect(result[0].text).toBe("arial text");
      expect(result[0].tags).toEqual([{ name: "font", value: "Arial" }]);
    });

    it("should parse opacity tag with value", () => {
      const result = parser.parse("[opacity=50]semi-transparent[/opacity]");
      expect(result[0].text).toBe("semi-transparent");
      expect(result[0].tags).toEqual([{ name: "opacity", value: "50" }]);
    });

    it("should parse hide tag", () => {
      const result = parser.parse("[hide]hidden text[/hide]");
      expect(result[0].text).toBe("hidden text");
      expect(result[0].tags).toEqual([{ name: "hide" }]);
    });

    it("should parse background tag with value", () => {
      const result = parser.parse("[background=#ffff00]highlighted[/background]");
      expect(result[0].text).toBe("highlighted");
      expect(result[0].tags).toEqual([{ name: "background", value: "#ffff00" }]);
    });

    it("should parse offsetx tag with value", () => {
      const result = parser.parse("[offsetx=10]shifted[/offsetx]");
      expect(result[0].text).toBe("shifted");
      expect(result[0].tags).toEqual([{ name: "offsetx", value: "10" }]);
    });

    it("should parse offsety tag with percentage value", () => {
      const result = parser.parse("[offsety=50%]shifted[/offsety]");
      expect(result[0].text).toBe("shifted");
      expect(result[0].tags).toEqual([{ name: "offsety", value: "50%" }]);
    });

    it("should parse stroke tag", () => {
      const result = parser.parse("[stroke]stroked text[/stroke]");
      expect(result[0].text).toBe("stroked text");
      expect(result[0].tags).toEqual([{ name: "stroke" }]);
    });

    it("should parse outline tag with value", () => {
      const result = parser.parse("[outline=#ff0000]outlined[/outline]");
      expect(result[0].text).toBe("outlined");
      expect(result[0].tags).toEqual([{ name: "outline", value: "#ff0000" }]);
    });

    it("should parse outlineback tag with value", () => {
      const result = parser.parse("[outlineback=#00ff00]outlined[/outlineback]");
      expect(result[0].text).toBe("outlined");
      expect(result[0].tags).toEqual([{ name: "outlineback", value: "#00ff00" }]);
    });

    it("should parse lineThickness tag with value", () => {
      const result = parser.parse("[lineThickness=0.1]thick lines[/lineThickness]");
      expect(result[0].text).toBe("thick lines");
      expect(result[0].tags).toEqual([{ name: "lineThickness", value: "0.1" }]);
    });
  });

  describe("Multiple segments", () => {
    it("should parse text with multiple tags", () => {
      const result = parser.parse("Hello [b]bold[/b] world");
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("Hello ");
      expect(result[0].tags).toEqual([]);
      expect(result[1].text).toBe("bold");
      expect(result[1].tags).toEqual([{ name: "b" }]);
      expect(result[2].text).toBe(" world");
      expect(result[2].tags).toEqual([]);
    });

    it("should parse adjacent tags", () => {
      const result = parser.parse("[b]bold[/b][i]italic[/i]");
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("bold");
      expect(result[0].tags).toEqual([{ name: "b" }]);
      expect(result[1].text).toBe("italic");
      expect(result[1].tags).toEqual([{ name: "i" }]);
    });
  });

  describe("Nested tags", () => {
    it("should parse nested bold and italic", () => {
      const result = parser.parse("[b][i]bold italic[/i][/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("bold italic");
      expect(result[0].tags).toEqual([
        { name: "b" },
        { name: "i" },
      ]);
    });

    it("should parse deeply nested tags", () => {
      const result = parser.parse("[b][i][u]bold italic underline[/u][/i][/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("bold italic underline");
      expect(result[0].tags).toEqual([
        { name: "b" },
        { name: "i" },
        { name: "u" },
      ]);
    });

    it("should parse mixed nested and sequential tags", () => {
      const result = parser.parse("[b]bold [i]bold italic[/i] bold again[/b]");
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("bold ");
      expect(result[0].tags).toEqual([{ name: "b" }]);
      expect(result[1].text).toBe("bold italic");
      expect(result[1].tags).toEqual([{ name: "b" }, { name: "i" }]);
      expect(result[2].text).toBe(" bold again");
      expect(result[2].tags).toEqual([{ name: "b" }]);
    });

    it("should parse nested size tags", () => {
      const result = parser.parse("[size=1.5]Large [size=0.5]Small[/size] Large again[/size]");
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("Large ");
      expect(result[0].tags).toEqual([{ name: "size", value: "1.5" }]);
      expect(result[1].text).toBe("Small");
      // Inner size tag overrides outer (both use baseFontSize * ratio)
      expect(result[1].tags).toEqual([
        { name: "size", value: "1.5" },
        { name: "size", value: "0.5" },
      ]);
      expect(result[2].text).toBe(" Large again");
      expect(result[2].tags).toEqual([{ name: "size", value: "1.5" }]);
    });

    it("should parse deeply nested size tags", () => {
      const result = parser.parse("[size=2.0]A[size=1.5]B[size=1.0]C[/size]B[/size]A[/size]");
      expect(result).toHaveLength(5);
      expect(result[0].text).toBe("A");
      expect(result[0].tags).toEqual([{ name: "size", value: "2.0" }]);
      expect(result[1].text).toBe("B");
      expect(result[1].tags).toEqual([
        { name: "size", value: "2.0" },
        { name: "size", value: "1.5" },
      ]);
      expect(result[2].text).toBe("C");
      expect(result[2].tags).toEqual([
        { name: "size", value: "2.0" },
        { name: "size", value: "1.5" },
        { name: "size", value: "1.0" },
      ]);
      expect(result[3].text).toBe("B");
      expect(result[3].tags).toEqual([
        { name: "size", value: "2.0" },
        { name: "size", value: "1.5" },
      ]);
      expect(result[4].text).toBe("A");
      expect(result[4].tags).toEqual([{ name: "size", value: "2.0" }]);
    });

    it("should parse size nested with other tags", () => {
      const result = parser.parse("[b][size=1.5]Bold and Large[/size][/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Bold and Large");
      expect(result[0].tags).toEqual([
        { name: "b" },
        { name: "size", value: "1.5" },
      ]);
    });
  });

  describe("Escape characters", () => {
    it("should parse escaped bracket as literal bracket", () => {
      const result = parser.parse("[[b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("[b]");
      expect(result[0].tags).toEqual([]);
    });

    it("should parse multiple escaped brackets", () => {
      const result = parser.parse("[[b]text[[/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("[b]text[/b]");
      expect(result[0].tags).toEqual([]);
    });

    it("should handle escape in the middle of text", () => {
      const result = parser.parse("Hello [[b] World");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello [b] World");
      expect(result[0].tags).toEqual([]);
    });
  });

  describe("Unclosed tags", () => {
    it("should treat unclosed tag as plain text", () => {
      const result = parser.parse("[b]unclosed");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("[b]unclosed");
      expect(result[0].tags).toEqual([]);
    });

    it("should handle valid tags followed by unclosed tag", () => {
      const result = parser.parse("[b]bold[/b] text [i]unclosed");
      // Valid [b] tag is parsed, unclosed [i] becomes plain text
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("bold");
      expect(result[0].tags).toEqual([{ name: "b" }]);
      expect(result[1].text).toBe(" text ");
      expect(result[1].tags).toEqual([]);
      expect(result[2].text).toBe("[i]unclosed");
      expect(result[2].tags).toEqual([]);
    });

    it("should handle unclosed tag in the middle", () => {
      const result = parser.parse("start [b]bold [i]italic");
      // Text before [b] is valid, rest becomes plain text
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("start ");
      expect(result[0].tags).toEqual([]);
      expect(result[1].text).toBe("[b]bold [i]italic");
      expect(result[1].tags).toEqual([]);
    });
  });

  describe("Mismatched closing tags", () => {
    it("should treat mismatched closing tag as plain text", () => {
      const result = parser.parse("[/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("[/b]");
      expect(result[0].tags).toEqual([]);
    });

    it("should handle mismatched tag in the middle", () => {
      const result = parser.parse("hello [/b] world");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("hello [/b] world");
      expect(result[0].tags).toEqual([]);
    });
  });

  describe("Newlines", () => {
    it("should preserve newlines in text", () => {
      const result = parser.parse("line1\nline2");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("line1\nline2");
    });

    it("should handle newlines inside tags", () => {
      const result = parser.parse("[b]line1\nline2[/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("line1\nline2");
      expect(result[0].tags).toEqual([{ name: "b" }]);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty tag", () => {
      const result = parser.parse("[b][/b]");
      expect(result).toHaveLength(0);
    });

    it("should handle tag with only whitespace", () => {
      const result = parser.parse("[b]   [/b]");
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("   ");
      expect(result[0].tags).toEqual([{ name: "b" }]);
    });

    it("should handle tag at the start", () => {
      const result = parser.parse("[b]start[/b] end");
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("start");
      expect(result[0].tags).toEqual([{ name: "b" }]);
      expect(result[1].text).toBe(" end");
      expect(result[1].tags).toEqual([]);
    });

    it("should handle tag at the end", () => {
      const result = parser.parse("start [b]end[/b]");
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("start ");
      expect(result[0].tags).toEqual([]);
      expect(result[1].text).toBe("end");
      expect(result[1].tags).toEqual([{ name: "b" }]);
    });

    it("should handle special characters in text", () => {
      const result = parser.parse('[b]hello <world> & "test"[/b]');
      expect(result[0].text).toBe('hello <world> & "test"');
    });
  });

  describe("Complex scenarios", () => {
    it("should parse complex mixed content", () => {
      const input = "Hello [b]bold[/b] and [color=#ff0000]red [i]italic[/i] text[/color]!";
      const result = parser.parse(input);
      expect(result).toHaveLength(7);
      expect(result[0].text).toBe("Hello ");
      expect(result[0].tags).toEqual([]);
      expect(result[1].text).toBe("bold");
      expect(result[1].tags).toEqual([{ name: "b" }]);
      expect(result[2].text).toBe(" and ");
      expect(result[2].tags).toEqual([]);
      expect(result[3].text).toBe("red ");
      expect(result[3].tags).toEqual([{ name: "color", value: "#ff0000" }]);
      expect(result[4].text).toBe("italic");
      expect(result[4].tags).toEqual([
        { name: "color", value: "#ff0000" },
        { name: "i" },
      ]);
      expect(result[5].text).toBe(" text");
      expect(result[5].tags).toEqual([{ name: "color", value: "#ff0000" }]);
      expect(result[6].text).toBe("!");
      expect(result[6].tags).toEqual([]);
    });

    it("should handle multiple same-type tags", () => {
      const result = parser.parse("[b]first[/b] middle [b]second[/b]");
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("first");
      expect(result[0].tags).toEqual([{ name: "b" }]);
      expect(result[1].text).toBe(" middle ");
      expect(result[1].tags).toEqual([]);
      expect(result[2].text).toBe("second");
      expect(result[2].tags).toEqual([{ name: "b" }]);
    });
  });
});
