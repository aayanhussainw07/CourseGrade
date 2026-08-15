## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Git workflow

- After every completed change, stage only the files related to that change, create a focused commit, and push the current branch to its remote
- Never include unrelated or pre-existing working-tree changes in a commit
