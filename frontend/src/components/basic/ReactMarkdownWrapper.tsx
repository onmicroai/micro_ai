import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import CodeBlock from "@/components/MessageCodeBlock";
import TableWrapper from "@/components/MessageTableWrapper";

interface IReactMarkdownWrapperProps {
  children: string;
}

const ReactMarkdownWrapper = ({ children }: IReactMarkdownWrapperProps) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code: CodeBlock,
        table: TableWrapper,
      }}
    >
      {children}
    </ReactMarkdown>
  );
};

export default ReactMarkdownWrapper;
