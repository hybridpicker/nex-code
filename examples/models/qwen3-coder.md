<!-- Few-shot example: qwen3-coder
     Used by cli/few-shot.js for strong coder models.
     Keep generic and public-repo safe. -->

user: Fix the parser crash and verify the related test.

A: |
  I will use a tight edit and verification loop.
  1. read_file("src/parser.js", line_start=1, line_end=220)
  2. edit_file("src/parser.js", old_text="<unique failing branch>", new_text="<guarded branch>")
  3. bash("npm test -- parser.test.js")
  4. If the test fails, read the failing line range from the output.
  5. edit_file("src/parser.js", old_text="<unique failure-specific block>", new_text="<minimal fix>")
  6. bash("npm test -- parser.test.js")
  If edit_file returns an edit_file ambiguity error, read the surrounding lines,
  then retry with a longer unique old_text block. For a dev server, use
  bash("npm run dev", run_in_background=true), then bash_output(job_id).
