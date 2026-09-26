import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * MathRenderer: Component kết xuất Markdown & Công thức Toán học LaTeX chuẩn KaTeX
 * Hỗ trợ:
 * - Block Math: $$...$$
 * - Inline Math: $...$
 * - Markdown Headings, Bold, Inline Code, Code Block, Lists
 */
export const MathRenderer = ({ content, className = '' }) => {
  if (!content) return null;

  const renderContent = (text) => {
    if (!text || typeof text !== 'string') return '';

    // 1. Tạm lưu các khối code block ```lang ... ``` để không bị format nhầm
    const codeBlocks = [];
    let processed = text.replace(/```([a-z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `___CODE_BLOCK_${codeBlocks.length}___`;
      codeBlocks.push({ lang, code });
      return id;
    });

    // 2. Tạm lưu inline code `...`
    const inlineCodes = [];
    processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
      const id = `___INLINE_CODE_${inlineCodes.length}___`;
      inlineCodes.push(code);
      return id;
    });

    // 3. Xử lý Block Math: $$...$$
    const blockMaths = [];
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
      const id = `___BLOCK_MATH_${blockMaths.length}___`;
      try {
        const rendered = katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
          strict: false
        });
        blockMaths.push(
          `<div class="katex-display-container my-3.5 p-3 rounded-xl bg-[#0f1011] border border-[#23252a] overflow-x-auto text-[#f7f8f8] flex items-center justify-center select-text font-serif text-base">${rendered}</div>`
        );
      } catch (e) {
        blockMaths.push(`<div class="katex-display-container my-2 p-2 bg-red-500/10 text-red-400 font-mono text-xs">${formula}</div>`);
      }
      return id;
    });

    // 4. Xử lý Inline Math: $...$
    const inlineMaths = [];
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      const id = `___INLINE_MATH_${inlineMaths.length}___`;
      try {
        const rendered = katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
          strict: false
        });
        inlineMaths.push(`<span class="katex-inline-formula text-cyan-300 font-serif font-medium px-0.5 select-text">${rendered}</span>`);
      } catch (e) {
        inlineMaths.push(`<span class="text-orange-400 font-mono text-xs">$${formula}$</span>`);
      }
      return id;
    });

    // 5. Escape HTML còn lại (chống stored-XSS từ đề bài/editorial).
    // Các placeholder ___...___ không chứa ký tự đặc biệt nên an toàn;
    // code/math đã tách ra trước đó, KaTeX tự escape output của nó.
    processed = processed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // 6. Định dạng Markdown cơ bản:
    // Tiêu đề h3 (### ...)
    processed = processed.replace(/^### (.*$)/gim, '<h3 class="text-sm font-extrabold text-white mt-4 mb-2 flex items-center gap-2 tracking-tight"><span class="w-1.5 h-1.5 rounded-full bg-[#ff6600]"></span>$1</h3>');
    // Tiêu đề h2 (## ...)
    processed = processed.replace(/^## (.*$)/gim, '<h2 class="text-base font-extrabold text-white mt-5 mb-2.5 tracking-tight border-b border-white/10 pb-1">$1</h2>');
    
    // In đậm (**text**)
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>');

    // Danh sách đầu dòng (- hoặc *)
    processed = processed.replace(/^[\*\-] (.*$)/gim, '<div class="flex items-start gap-2 my-1 ml-1 text-slate-300"><span class="text-[#ff6600] font-bold mt-0.5">•</span><span>$1</span></div>');

    // Danh sách đánh số (1. 2. 3.)
    processed = processed.replace(/^(\d+)\. (.*$)/gim, '<div class="flex items-start gap-2 my-1 ml-1 text-slate-300"><span class="px-1.5 py-0.2 rounded bg-white/10 text-xs font-mono font-bold text-slate-300 shrink-0">$1</span><span>$2</span></div>');

    // Chuyển ký tự xuống dòng \n thành <br/> (trừ các khối đặc biệt)
    processed = processed.replace(/\n/g, '<br/>');

    // 6. Khôi phục các thành phần
    // Inline math
    inlineMaths.forEach((html, i) => {
      processed = processed.replace(`___INLINE_MATH_${i}___`, html);
    });

    // Block math
    blockMaths.forEach((html, i) => {
      processed = processed.replace(`___BLOCK_MATH_${i}___`, html);
    });

    // Inline codes
    inlineCodes.forEach((code, i) => {
      const codeHtml = `<code class="px-1.5 py-0.5 rounded bg-white/10 text-[#d0d6e0] font-mono text-xs border border-[#23252a]">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
      processed = processed.replace(`___INLINE_CODE_${i}___`, codeHtml);
    });

    // Code blocks
    codeBlocks.forEach(({ lang, code }, i) => {
      const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const blockHtml = `<div class="my-3 rounded-xl bg-[#060913] border border-white/10 overflow-hidden text-xs font-mono shadow-md">
        <div class="h-6 bg-[#0c101c] px-3 flex items-center justify-between border-b border-white/5 text-[10px] text-slate-400">
          <span>${lang || 'code'}</span>
          <span>Source Code</span>
        </div>
        <pre class="p-3.5 text-emerald-400 overflow-x-auto leading-relaxed"><code>${escapedCode}</code></pre>
      </div>`;
      processed = processed.replace(`___CODE_BLOCK_${i}___`, blockHtml);
    });

    return processed;
  };

  return (
    <div 
      className={`math-rendered-content text-slate-300 text-sm leading-relaxed space-y-2 select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: renderContent(content) }}
    />
  );
};
