# KAkAo generated app template

Create a GitHub repository from this folder and mark it as a **Template repository**
(Settings → General → Template repository). Put its name in `functions/.env`:

```
GITHUB_TEMPLATE_REPO=your-user/kakao-app-template
```

When a paid user publishes, KAKAO creates a private repo from this template, commits
`assets/design.json`, and the workflow builds an Android APK (attached to the latest release)
and a web build.
