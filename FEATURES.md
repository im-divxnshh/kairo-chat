# Kairo implementation checklist

Last updated: 2026-10-31

**Overall: 238 / 257 checklist items complete (92.6%). 16 active items remain; 1 deferred; 2 replaced.**

| Scope | Complete | Total | Completion |
| --- | ---: | ---: | ---: |
| Original features | 215 | 233 | 92.3% |
| Firebase additions | 9 | 10 | 90.0% |
| Environment, R2 and performance additions | 10 | 10 | 100.0% |
| Branding additions | 4 | 4 | 100.0% |

Remaining work: **0 in progress**, **16 need setup or verification**, **0 pending**. Separately, **1 deferred until later** and **2 items are replaced** and do not require implementation.

Implementation tasks left: **0**. External checks delegated to the user: **16**. See [USER_CHECKS.md](docs/USER_CHECKS.md).

Verification uses unit tests, isolated Git repositories, fake CLI subprocesses and DOM UI tests. Live Firebase/R2 verification and Codex responses passed in the user’s terminal on 2026-10-31. Native desktop and remaining live checks are tracked separately; local tests do not establish those results.

A checked feature has an implemented application path and verification evidence. In-progress code, configuration screens, untested integrations, and installer commands alone do not count as complete. Category checkboxes are checked only when every feature in the category is complete.

Firebase Authentication and Cloud Firestore are the requested identity and primary database. Feature 203 (SQLite) is retained for traceability and marked replaced, rather than silently removed or counted as complete.

| Category | Complete | In progress | Needs setup | Pending / deferred / replaced |
| --- | ---: | ---: | ---: | ---: |
| Providers and CLI | 11/12 | 0 | 0 | 1 |
| Conversations and messages | 27/27 | 0 | 0 | 0 |
| Files and attachments | 15/15 | 0 | 0 | 0 |
| Projects and workspaces | 15/16 | 0 | 1 | 0 |
| Git and GitHub | 18/19 | 0 | 1 | 0 |
| Preferences and memory | 16/16 | 0 | 0 | 0 |
| Prompt library | 13/13 | 0 | 0 | 0 |
| Search and knowledge | 14/14 | 0 | 0 | 0 |
| Design and accessibility | 22/24 | 0 | 2 | 0 |
| Settings and diagnostics | 18/19 | 0 | 1 | 0 |
| Usage and observability | 13/13 | 0 | 0 | 0 |
| Notifications | 6/8 | 0 | 2 | 0 |
| Backup, database and sync | 10/11 | 0 | 0 | 1 |
| Agents, MCP and workflows | 14/14 | 0 | 0 | 0 |
| Additional providers and capabilities | 3/7 | 0 | 3 | 1 |
| Desktop applications and installers | 0/5 | 0 | 5 | 0 |
| Firebase authentication and database | 9/10 | 0 | 1 | 0 |
| Environment, Cloudflare R2 and performance | 10/10 | 0 | 0 | 0 |
| Branding and launcher animation | 4/4 | 0 | 0 | 0 |

## Providers and CLI

- [ ] Category complete — 11/12

- [ ] **1. Claude Code integration** — Deferred by user. Deferred at the user’s request on 2026-10-31; Codex is the active provider for now. Native Claude settings/transport tests pass, but normal-mode verification timed out at 60 seconds and safe-mode verification at 120 seconds during the request. Live response remains unverified and will be revisited later.
- [x] **2. OpenAI Codex integration** — Complete. Codex native config.toml transport is implemented and verified by subprocess/configuration tests. The user confirmed a live Codex response with npm run verify:cli on 2026-10-31.
- [x] **3. Provider switcher** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **4. Custom model support** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **5. Model selector** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **6. Multiple CLI configurations** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **7. Automatic CLI detection** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **8. Custom executable paths** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **9. Connection testing** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **10. Provider authentication status** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **11. CLI version detection** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.
- [x] **12. Provider usage information** — Complete. Provider configuration, CLI subprocess/stream tests, and installed CLI detection checks; live AI responses still need provider authentication and connectivity.

## Conversations and messages

- [x] Category complete — 27/27

- [x] **13. New chat** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **14. Multiple conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **15. Conversation history** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **16. Rename conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **17. Delete conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **18. Archive conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **19. Pin conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **20. Conversation search** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **21. Message search** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **22. Streaming responses** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **23. Stop generation** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **24. Regenerate response** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **25. Edit previous message** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **26. Continue response** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **27. Copy response** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **28. Markdown rendering** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **29. Code syntax highlighting** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **30. Code copy button** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **31. LaTeX rendering** — Complete. Native MathML renders common LaTeX fractions, roots, scripts, symbols and matrices. Markdown/math tests verify formatting, code-fence preservation and escaped invalid formulas.
- [x] **32. Message timestamps** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **33. Response feedback** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **34. Branch conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **35. Temporary chats** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **36. Export conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **37. Import conversations** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **38. Conversation tags** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.
- [x] **39. Conversation folders** — Complete. Implemented renderer/backend conversation path; verified by DOM chat tests and cloud/main-process integration tests.

## Files and attachments

- [x] Category complete — 15/15

- [x] **40. Code file attachments** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **41. Text file attachments** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **42. Multiple file attachments** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **43. Drag and drop files** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **44. Folder attachments** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **45. File preview** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **46. Image attachments** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **47. PDF support** — Complete. macOS PDFKit text extraction and chat-context delivery pass an actual generated-PDF test. Native helper packaging is configured; textless/password-protected PDFs are reported explicitly. Other platforms use pdftotext.
- [x] **48. CSV preview** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **49. JSON preview** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **50. Syntax highlighting** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **51. Recent files** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **52. Attachment history** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **53. File reference management** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.
- [x] **54. Sensitive file detection** — Complete. Attachment reading/previews, R2 references and file-boundary checks; verified by core, UI and main-process integration tests.

## Projects and workspaces

- [ ] Category complete — 15/16

- [x] **55. Create projects** — Complete. Dedicated project creation selects a parent folder, validates the new name and refuses existing folders. Filesystem and Electron backend tests exercise creation and project-window routing.
- [x] **56. Open existing projects** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **57. Project switcher** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **58. Recent projects** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **59. Project conversations** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **60. Project instructions** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **61. Project configuration** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **62. File explorer** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **63. File search** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **64. Git repository detection** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **65. Project memory** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **66. Project notes** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **67. Project bookmarks** — Complete. Project records, scope controls and file explorer implemented; scoped file traversal tests and shared record/DOM form checks pass.
- [x] **68. Project activity history** — Complete. Project and conversation saves/deletions and Git actions write scoped activity records. The backend/cloud integration exercises record persistence; the Activity page reads those records.
- [ ] **69. Multiple project windows** — Needs setup / verification. Multiple-window backend construction and project routing tests pass. User check: open two project windows in native Electron and confirm independent views.
- [x] **70. Workspace layouts** — Complete. Chat, project and review presets persist usable width/sidebar/split-view settings and restore the selected route. Runtime and DOM preset tests pass.

## Git and GitHub

- [ ] Category complete — 18/19

- [x] **71. Git status** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **72. Branch switcher** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **73. Commit history** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **74. Stage changes** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **75. Unstage changes** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **76. Commit changes** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **77. View diffs** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **78. AI code review** — Complete. DOM workflow test sends the captured project diff to the selected CLI for review.
- [x] **79. AI commit message generation** — Complete. DOM workflow test verifies staged diff input, editable AI commit review and committing the reviewed message.
- [x] **80. Create branches** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **81. Merge branches** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **82. Pull and push** — Complete. Isolated bare-remote integration test verifies push, clone and pull preserve committed file contents.
- [x] **83. Git stash** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **84. Conflict detection** — Complete. Git action implemented and exercised in an isolated test repository; tests/git.test.js.
- [x] **85. Conflict explanation** — Complete. DOM conflict workflow passes complete conflict hunks to the CLI; runtime tests verify file boundaries.
- [x] **86. AI merge resolution** — Complete. DOM workflow requires reviewed resolution text and the original hash; runtime tests reject stale writes and retain backups.
- [ ] **87. GitHub integration** — Needs setup / verification. GitHub CLI discovery and diff actions plus PR summary/review UI are implemented. User check: authenticate gh and open a real repository PR; GitHub network access is unavailable here.
- [x] **88. Pull request summaries** — Complete. DOM PR workflow sends the captured PR diff through the dedicated summary action.
- [x] **89. Pull request reviews** — Complete. DOM PR workflow sends the captured diff through the separate bugs, risks and missing-tests review action.

## Preferences and memory

- [x] Category complete — 16/16

- [x] **90. Global AI preferences** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **91. Personal instructions** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **92. Coding preferences** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **93. Preferred programming languages** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **94. Preferred frameworks** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **95. Project-specific memory** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **96. Conversation memory** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **97. Saved facts** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **98. Saved code snippets** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **99. Memory search** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **100. Memory editor** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **101. Memory import/export** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **102. Enable/disable memory** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **103. Context-aware suggestions** — Complete. Suggestions respond to the selected project, recent conversations and task failures. Scoped suggestion tests pass.
- [x] **104. Remember preferred provider** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **105. Custom system instructions** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.

## Prompt library

- [x] Category complete — 13/13

- [x] **106. Built-in prompt library** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **107. Custom prompts** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **108. Prompt categories** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **109. Prompt search** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **110. Favorite prompts** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **111. Prompt variables** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **112. Prompt templates** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **113. Prompt editing** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **114. Prompt duplication** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **115. Prompt import/export** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **116. Prompt history** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.
- [x] **117. Prompt keyboard shortcuts** — Complete. Prompt shortcuts are connected to template insertion. DOM tests exercise modifier handling and shifted digit keys.
- [x] **118. Project-specific prompts** — Complete. Scoped record editors/templates and context integration implemented; core search/context/template validation and DOM form checks pass.

## Search and knowledge

- [x] Category complete — 14/14

- [x] **119. Global conversation search** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **120. Search messages** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **121. Search projects** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **122. Search attachments** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **123. Search prompts** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **124. Search code snippets** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **125. Search project files** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **126. Semantic search** — Complete. Scoped candidate validation, real fixture CLI ranking and DOM result mapping pass; unknown returned IDs are rejected.
- [x] **127. Local knowledge base** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **128. Document indexing** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **129. Project documentation indexing** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **130. Knowledge collections** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **131. Source references** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.
- [x] **132. Search filters** — Complete. Word search and source/document records implemented; core search/filter tests pass. This does not claim semantic embeddings.

## Design and accessibility

- [ ] Category complete — 22/24

- [x] **133. Apple-inspired design** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **134. Dark theme** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **135. Light theme** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **136. System theme** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **137. Custom accent colors** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **138. Glassmorphism** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **139. Smooth animations** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [ ] **140. Native window controls** — Needs setup / verification. Native title bars and controls are configured. User check: minimize, maximize and close on the target OS; Electron cannot launch in this sandbox.
- [x] **141. Resizable sidebar** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **142. Collapsible sidebar** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **143. Responsive layout** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **144. Split chat view** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [ ] **145. Full-screen mode** — Needs setup / verification. Full-screen IPC toggle passes backend tests. User check: enter and exit full screen in the native desktop app.
- [x] **146. Floating composer** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **147. Custom scrollbars** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **148. Command palette** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **149. Context menus** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **150. Keyboard shortcuts** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **151. Customizable toolbar** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **152. Adjustable font size** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **153. Adjustable chat width** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **154. Compact mode** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **155. Accessibility options** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.
- [x] **156. Reduced motion** — Complete. CSS/renderer controls implemented; DOM theme, composer, split-provider and UI interaction checks pass. Native visual review remains unverified.

## Settings and diagnostics

- [ ] Category complete — 18/19

- [x] **157. General settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **158. Appearance settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **159. Provider settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **160. Model settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **161. CLI settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **162. File attachment settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [ ] **163. Terminal settings** — Needs setup / verification. Terminal command paths, custom executable and arguments are implemented. User check: open a project terminal on the target OS.
- [x] **164. Git settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **165. Memory settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **166. Privacy settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **167. Keyboard shortcut settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **168. Notification settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **169. Backup settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **170. Custom data storage location** — Complete. Local cache, queued edits and backups can move to a selected folder with the original retained. Filesystem and backend relocation tests pass.
- [x] **171. Reset application** — Complete. Workspace reset backs up first, cancels active tasks, clears account records, restores defaults and synchronizes. The backend test verifies reset after relocation.
- [x] **172. Import settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **173. Export settings** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **174. Configuration validation** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.
- [x] **175. Diagnostic logs** — Complete. Settings and diagnostic paths implemented; validation, DOM setting controls, export and main-process tests pass.

## Usage and observability

- [x] Category complete — 13/13

- [x] **176. Token usage tracking** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **177. Request duration** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **178. Response duration** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **179. Session statistics** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **180. Conversation statistics** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **181. Agent task statistics** — Complete. DOM Activity test verifies per-agent task counts, failures, tokens and duration.
- [x] **182. Error logs** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **183. CLI execution logs** — Complete. Backend and DOM tests verify per-task CLI events, timings, status, usage and log display.
- [x] **184. Context usage information** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **185. Provider health status** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **186. Usage charts** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **187. Local activity dashboard** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.
- [x] **188. API key protection** — Complete. Run metadata and statistics recorded/displayed; provider usage, timing, environment isolation and backend integration checks pass.

## Notifications

- [ ] Category complete — 6/8

- [x] **189. Agent completed notification** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [x] **190. Agent failed notification** — Complete. Backend integration test verifies preflight failures create failure task records and notification history.
- [x] **191. Long-running task notification** — Complete. Backend timer test verifies the long-task alert fires during an active CLI request.
- [x] **192. Permission request notification** — Complete. Claude permission protocol allow/deny tests and DOM decision controls pass; requests are bound to their originating window.
- [x] **193. CLI disconnected notification** — Complete. Provider health polling detects a connected CLI becoming unavailable and creates a disconnect notification; backend test passes.
- [x] **194. Update available notification** — Complete. Release manifest tests verify numeric versions, HTTPS, credential rejection, size limits and HTTP errors; backend update notification test passes.
- [ ] **195. Custom notification sounds** — Needs setup / verification. Sound selection, one-window playback dispatch and missing-file system fallback pass backend tests. User check: hear custom and system sounds on the desktop.
- [ ] **196. Desktop notifications** — Needs setup / verification. Notification history and native delivery calls pass backend tests. User check: allow Kairo notifications and confirm OS delivery.

## Backup, database and sync

- [ ] Category complete — 10/11

- [x] **197. Automatic local backups** — Complete. Backend integration test triggers the actual backup timer and confirms a local backup; timing, manual backup and encrypted restore tests pass.
- [x] **198. Manual backup** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [x] **199. Restore backup** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [x] **200. Export all conversations** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [x] **201. Export projects** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [x] **202. Restore projects** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [ ] **203. SQLite database** — Replaced. Superseded by the user request to use Firebase Firestore as the primary database. No SQLite dependency is required.
- [x] **204. Database migrations** — Complete. Cache boundary tests preserve queued user edits, migrate legacy provider profiles and reject future caches without rewriting them.
- [x] **205. Encrypted cloud backup** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [x] **206. Cross-device synchronization** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.
- [x] **207. Sync conflict resolution** — Complete. Local/R2 backup or Firestore synchronization path implemented; encrypted round-trip, conflict, account/cache and export integration tests pass.

## Agents, MCP and workflows

- [x] Category complete — 14/14

- [x] **208. Multi-agent collaboration** — Complete. Coordinator planning, parallel Claude/Codex specialists and final reconciliation share conversation context. The DOM test verifies all four provider requests and their handoffs.
- [x] **209. Claude and Codex parallel execution** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **210. Compare agent responses** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **211. Send task to multiple providers** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **212. AI task planning** — Complete. DOM planning workflow creates the requested planning prompt through the selected CLI.
- [x] **213. Agent-to-agent handoff** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **214. Custom agent profiles** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **215. Agent workflow builder** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **216. MCP server integration** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **217. MCP tools management** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **218. Custom MCP servers** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **219. Skills integration** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **220. Reusable agent workflows** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [x] **221. Scheduled agent tasks** — Complete. Backend scheduler test runs headlessly, records completion, counts missed intervals, keeps cadence and does not recreate deleted schedules.

## Additional providers and capabilities

- [ ] Category complete — 3/7

- [x] **222. Ollama integration** — Complete. Provider/profile/workflow or stdio MCP path implemented; parallel DOM, provider transport and MCP session tests pass. Live external integrations remain setup-dependent.
- [ ] **223. OpenAI-compatible API providers** — Replaced. Removed at the user request. AI access uses Claude settings.json and Codex config.toml instead of a direct OpenAI API provider.
- [x] **224. Custom API endpoints** — Complete. Custom provider endpoints are configured in native CLI files, including Codex model_providers. The user-confirmed Codex transport uses that configuration; Kairo has no direct API endpoint editor.
- [ ] **225. Browser research** — Needs setup / verification. Research UI and native Claude WebSearch/WebFetch / Codex live-search arguments pass tests. User check: run a real cited research task; sandbox networking is restricted.
- [x] **226. Visual debugging** — Complete. DOM screenshot workflow retains image attachments; real fixture subprocess tests verify Claude base64 and Codex image-file delivery.
- [ ] **227. Voice input** — Needs setup / verification. macOS speech helper compiles with embedded privacy descriptions; Windows capture and stop-file transport, cancellation and DOM draft delivery pass local tests. User check: microphone, OS permissions and dictation on the target OS.
- [ ] **228. Text-to-speech** — Needs setup / verification. DOM test verifies latest response is passed to system speech synthesis. User check: confirm audible speech on the target OS.

## Desktop applications and installers

- [ ] Category complete — 0/5

- [ ] **229. macOS application** — Needs setup / verification. Kairo macOS app packaging and native PDF/speech compilation work locally, with helpers unpacked and private environment files excluded. User check: launch the refreshed release/mac/Kairo.app and complete a signed-in chat; Electron aborts in this sandbox. Anime icon, installer styling and launcher animation details: docs/BRANDING.md; include the visual checks in docs/USER_CHECKS.md.
- [ ] **230. Windows application** — Needs setup / verification. Windows runtime paths and portable fixture tests are implemented; CI builds target Windows. User check: run the app on Windows; no Windows host is available here. Anime icon, installer styling and launcher animation details: docs/BRANDING.md; include the visual checks in docs/USER_CHECKS.md.
- [ ] **231. DMG installer** — Needs setup / verification. User check: build and install the DMG on the host. Previous disk-image creation failed with Device not configured in this sandbox. Anime icon, installer styling and launcher animation details: docs/BRANDING.md; include the visual checks in docs/USER_CHECKS.md.
- [ ] **232. Windows EXE installer** — Needs setup / verification. NSIS installer configuration and Windows CI build are supplied. User check: build/install the EXE on Windows; no Windows build host is available here. Anime icon, installer styling and launcher animation details: docs/BRANDING.md; include the visual checks in docs/USER_CHECKS.md.
- [ ] **233. Windows MSI installer** — Needs setup / verification. MSI installer configuration and Windows CI build are supplied. User check: build/install the MSI on Windows; no Windows build host is available here. Anime icon, installer styling and launcher animation details: docs/BRANDING.md; include the visual checks in docs/USER_CHECKS.md.

## Firebase authentication and database

- [ ] Category complete — 9/10

- [x] **F1. Firebase project configuration** — Complete. Implemented and verified by Firebase REST contract tests, packaged Electron backend integration tests and DOM account controls. Users save their own Firebase/R2 settings inside the app without .env; local restart and protected-storage checks pass. Live project deployment is still required.
- [x] **F2. Email and password registration** — Complete. Implemented and verified by Firebase REST contract tests, Electron backend integration tests and DOM account controls; live project deployment is still required.
- [x] **F3. Email and password sign-in** — Complete. Implemented and verified by Firebase REST contract tests, Electron backend integration tests and DOM account controls; live project deployment is still required.
- [x] **F4. Sign out and secure session persistence** — Complete. Implemented and verified by Firebase REST contract tests, Electron backend integration tests and DOM account controls; live project deployment is still required.
- [x] **F5. Password reset** — Complete. Implemented and verified by Firebase REST contract tests, Electron backend integration tests and DOM account controls; live project deployment is still required.
- [x] **F6. Email verification** — Complete. Implemented and verified by Firebase REST contract tests, Electron backend integration tests and DOM account controls; live project deployment is still required.
- [x] **F7. Firestore user-isolated database** — Complete. Implemented and verified by Firebase REST contract tests, Electron backend integration tests and DOM account controls; live project deployment is still required.
- [x] **F8. Firestore security rules** — Complete. User ran live deployment and verification on 2026-10-31. Firestore permits owner reads/writes and rejects cross-account, anonymous and invalid-schema requests; optimistic concurrency checks pass.
- [x] **F9. Cloud synchronization and conflict detection** — Complete. Implemented and verified by Firebase REST contract tests, Electron backend integration tests and DOM account controls; live project deployment is still required.
- [ ] **F10. Firebase emulator verification** — Needs setup / verification. Auth and Firestore emulator configuration is supplied. User check: start the emulators and exercise text-only auth/database flows; sandbox listening ports are prohibited.

## Environment, Cloudflare R2 and performance

- [x] Category complete — 10/10

- [x] **R1. Environment-based Firebase configuration** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R2. Environment-based native CLI configuration** — Complete. Optional KAIRO_CLAUDE_SETTINGS_FILE and KAIRO_CODEX_CONFIG_FILE select existing native CLI configurations. File precedence, credential isolation and migration tests pass. Direct OpenAI API keys are not used.
- [x] **R3. Private Cloudflare R2 object storage** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R4. Firebase-authenticated R2 Worker** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R5. R2 attachment upload and retrieval** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R6. Encrypted R2 backup and restore** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R7. Incremental Firestore synchronization** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R8. Attachment download caching** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R9. Throttled streaming UI** — Complete. Implemented; environment, Worker signature/ownership, R2 round-trip, cache, incremental sync and DOM streaming checks pass.
- [x] **R10. Firebase and R2 production deployment verification** — Complete. User deployed Firebase rules and the existing kairo-chat Worker, then ran all 20 live checks successfully on 2026-10-31: authentication, owner/schema rules, preconditions, R2 operations, isolation, encrypted backup restore and cleanup.

## Branding and launcher animation

- [x] Category complete — 4/4

- [x] **B1. Original anime mascot and platform icon assets** — Complete. Original editable SVG and native raster artwork replace the lettermark. ICNS, multi-size ICO and PNG representations pass format checks; macOS sips decodes the ICNS at 1024 pixels.
- [x] **B2. Offline animated installer guide** — Complete. Start here.html has mascot, eye, sparkle and arrow animations, working pause/resume controls, local assets and reduced-motion CSS. DOM interaction checks pass. Finder installation is checked separately in #231.
- [x] **B3. Dock and taskbar animation controls** — Complete. 32 distinct frames, macOS Dock updates and Windows window/overlay updates. Tests cover frame cadence, busy tasks, settings/OS reduced motion, close/reopen, cleanup and missing native assets. Appearance controls persist through the UI. Native rendering remains user checks #229/#230.
- [x] **B4. Gen Z installer artwork and packaging configuration** — Complete. Retina DMG background and 24-bit NSIS header/sidebar assets validated; macOS and Windows builds use Kairo icons and shortcut names. Animated guide included in DMG contents. Actual installation remains #231/#232/#233.

## Updating progress

Edit the feature status and evidence in `docs/features.json`, then run `npm run progress`. Use `done` only after exercising the feature. Supported states: `pending`, `partial`, `blocked`, `deferred`, `replaced`, `done`. This file and the in-app progress screen use the same source.
