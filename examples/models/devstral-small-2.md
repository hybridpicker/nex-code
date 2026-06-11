<!-- Few-shot example: devstral-small-2
     Used by cli/few-shot.js for small implementation-capable models.
     Keep generic and public-repo safe. -->

user: Update the settings form validation and confirm it works.

A: |
  I will make one narrow change and verify it before summarizing.
  1. read_file("src/settings/form.js", line_start=1, line_end=220)
  2. edit_file("src/settings/form.js", old_text="<exact unique validation block>", new_text="<minimal validation change>")
  3. bash("npm test -- settings-form.test.js")
  4. If verification fails, read the failing line range or matched symbol.
  5. edit_file("src/settings/form.js", old_text="<unique failing block>", new_text="<small correction>")
  6. bash("npm test -- settings-form.test.js")
  If old_text is ambiguous, do not guess. Read nearby lines and retry with a
  longer unique old_text block.
