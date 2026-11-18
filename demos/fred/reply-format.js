// Stripped from fred/apps/mobile/src/reply-format.ts (types removed, unchanged otherwise)
(()=>{/**
 * How a reply is laid out on screen (#209). Fred's words are not changed: the
 * cards, the model and the fixed replies all write plain lines ("a summary",
 * "1. a step", "Don't …", "Get medical help if …"), and this reads those lines
 * into blocks the app draws as steps, bullets, a warning group and paragraphs.
 *
 * It runs on every streamed token, so it must be cheap and must not trip on a
 * half-written line ("2" before its ". ", a "**" not yet closed).
 */

/** A run of text, bold or not. */
                       
                        
                         
 

                   
                                                              
                                                                                  
                                                                
                                                       
                                                               
                                                                            

const STEP = /^(\d{1,2})[.)]\s+(.*)$/;
const BULLET = /^[-*•]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;
/** A line that warns against something. The opening words are drawn bold. */
const WARN = /^(Don['’]t|Do not|Never)\b/;
/**
 * Openings that tell the hiker to get help. Drawn bold wherever they start a
 * line, so the one sentence that matters most is the easiest to find.
 */
const URGENT = /^(This is an emergency\.|Get (?:medical )?help(?: right away| now| fast)?|Call emergency services)/;
/** "Watch for signs of a concussion:" — a short lead before a colon reads as a label. */
const LEAD = /^([^:.!?]{3,48}):\s/;

/** Split `**bold**` runs. An unclosed "**" (mid-stream) stays plain text. */
function spans(text        )         {
  const out         = [];
  let rest = text;
  for (;;) {
    const open = rest.indexOf('**');
    const close = open < 0 ? -1 : rest.indexOf('**', open + 2);
    if (open < 0 || close < 0) break;
    if (open > 0) out.push({ text: rest.slice(0, open), bold: false });
    if (close > open + 2) out.push({ text: rest.slice(open + 2, close), bold: true });
    rest = rest.slice(close + 2);
  }
  if (rest !== '') out.push({ text: rest, bold: false });
  return out;
}

/** Bold the line's opening words when they are a warning, a call for help or a short label. */
function emphasise(line        , warn         )         {
  if (line.includes('**')) return spans(line);
  const m = (warn ? WARN : URGENT).exec(line) ?? LEAD.exec(line);
  if (m === null) return spans(line);
  const head = m[0].endsWith(' ') ? m[0].trimEnd() : m[0];
  return [{ text: head, bold: true }, ...spans(line.slice(head.length))];
}

function layout(text        )          {
  const blocks          = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    let m                        ;
    if ((m = STEP.exec(line)) !== null) {
      blocks.push({ kind: 'step', n: Number(m[1]), spans: emphasise(m[2] , false) });
    } else if (WARN.test(line)) {
      const last = blocks.at(-1);
      const spansOf = emphasise(line, true);
      if (last?.kind === 'warn') blocks[blocks.length - 1] = { kind: 'warn', lines: [...last.lines, spansOf] };
      else blocks.push({ kind: 'warn', lines: [spansOf] });
    } else if ((m = BULLET.exec(line)) !== null) {
      blocks.push({ kind: 'bullet', spans: emphasise(m[1] , false) });
    } else if ((m = HEADING.exec(line)) !== null) {
      blocks.push({ kind: 'heading', text: m[1] .replaceAll('**', '') });
    } else {
      blocks.push({ kind: 'para', spans: emphasise(line, false) });
    }
  }
  return blocks;
}

/** The text a screen reader says for a step: "Step 2. …". */
function spoken(s                 )         {
  return s.map((x) => x.text).join('');
}

window.layout=layout;})();