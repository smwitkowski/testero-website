export interface McpToolResponse {
  success: boolean;
  results: {
    content: string;
    url: string;
  }[];
}
