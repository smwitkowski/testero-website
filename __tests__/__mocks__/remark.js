module.exports.remark = () => ({
  use: function () {
    return this;
  },
  process: async (content) => ({
    toString: () => {
      // Simple markdown to HTML conversion for tests
      let html = content;
      // Convert headers
      html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
      html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
      // Convert paragraphs
      html = html.replace(/\n\n/g, "</p>\n<p>");
      if (!html.startsWith("<")) {
        html = "<p>" + html;
      }
      if (!html.endsWith(">")) {
        html = html + "</p>";
      }
      return html;
    },
  }),
});
