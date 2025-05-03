const fs = require('fs');
const fetch = require('node-fetch');

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;

console.log(`Posting comment to PR #${prNumber}`);

if (!token || !repo || !prNumber) {
  console.error('❌ Missing environment variables.');
  process.exit(1);
}

const [owner, repoName] = repo.split('/');
const eslintReport = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));

if (!eslintReport.length) {
  console.log('✅ No ESLint issues found.');
  process.exit(0);
}

let commentBody = '### 🔍 ESLint Issues Found:\n\n';

// eslintReport.forEach(file => {
//   if (file.messages.length > 0) {
//     commentBody += `**${file.filePath}**\n`;
//     file.messages.forEach(msg => {
//       const emoji = msg.severity === 2 ? '❌ Error' : '⚠️ Warning';
//       commentBody += `- [${emoji}] Line ${msg.line}: ${msg.message} (${msg.ruleId})\n`;
//     });
//     commentBody += '\n';
//   }
// });

// const apiBase = `https://api.github.com/repos/${owner}/${repoName}`;
// const commentsUrl = `${apiBase}/issues/${prNumber}/comments`;

const apiBase = `https://api.github.com/repos/${owner}/${repoName}`;
const prUrl = `${apiBase}/pulls/${prNumber}`;
const filesUrl = `${prUrl}/files`;

async function getPRDiff() {
  try {
    const res = await fetch(filesUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch PR files: ${errText}`);
    }
    
    const files = await res.json();
    return files;
  } catch (err) {
    console.error('❌ Error fetching PR diff:', err);
    process.exit(1);
  }
}

async function getPRCommitSha() {
  try {
    const res = await fetch(prUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch PR info: ${errText}`);
    }

    const pr = await res.json();
    return pr.head.sha;
  } catch (err) {
    console.error('❌ Error fetching PR commit SHA:', err);
    process.exit(1);
  }
}

async function postInlineComment(file, msg, diffFiles, commitSha) {
  const fullPath = file.filePath;
  const repoRoot = process.cwd();

  // Normalize file path (strip absolute path prefix)
  const filePath = path.relative(repoRoot, fullPath);

  const matchingFile = diffFiles.find(f => f.filename === filePath);
  if (!matchingFile) {
    console.warn(`⚠️ Skipping comment: file not found in PR diff: ${filePath}`);
    return;
  }

  if (!matchingFile.patch) {
    console.warn(`⚠️ Skipping comment: no patch info for file: ${filePath}`);
    return;
  }

  // Try to match ESLint-reported line to a diff "position"
  const patchLines = matchingFile.patch.split('\n');
  let position = null;
  let lineInDiff = 0;
  let currentLine = 0;

  for (const line of patchLines) {
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/); // +startLine
      if (match) currentLine = parseInt(match[1], 10) - 1;
      continue;
    }

    if (!line.startsWith('-')) {
      currentLine++;
      lineInDiff++;
    }

    if (currentLine === msg.line) {
      position = lineInDiff;
      break;
    }

    if (!line.startsWith('-')) {
      lineInDiff++;
    }
  }

  if (position === null) {
    console.warn(`⚠️ No matching position in diff for ${filePath} line ${msg.line}`);
    return;
  }

  const commentBody = `⚠️ **[${msg.ruleId}]** ${msg.message}`;

  const res = await fetch(`${apiBase}/pulls/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      body: commentBody,
      commit_id: commitSha,
      path: filePath,
      position: position,
    }),
  });

  if (res.ok) {
    console.log(`✅ Comment posted on ${filePath} line ${msg.line}`);
  } else {
    const err = await res.text();
    console.error(`❌ Failed to post comment on ${filePath}:`, err);
  }
}

async function postInlineComments() {
  const [diffFiles, commitSha] = await Promise.all([
    getPRDiff(),
    getPRCommitSha(),
  ]);

  for (const file of eslintReport) {
    for (const msg of file.messages) {
      if (msg.severity > 0) {
        await postInlineComment(file, msg, diffFiles, commitSha);
      }
    }
  }
}

postInlineComments();

// async function postOrUpdateComment() {
//   try {
//     // 1. Get existing comments
//     const res = await fetch(commentsUrl, {
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Accept': 'application/vnd.github.v3+json',
//       },
//     });

//     const comments = await res.json();

//     // 2. Look for a previous ESLint comment
//     const existing = comments.find(comment =>
//       comment.user.type === 'Bot' &&
//       comment.body.startsWith('### 🔍 ESLint Issues Found:')
//     );

//     if (existing) {
//       // 3. Update existing comment
//       const updateRes = await fetch(`${apiBase}/issues/comments/${existing.id}`, {
//         method: 'PATCH',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Accept': 'application/vnd.github.v3+json',
//         },
//         body: JSON.stringify({ body: commentBody }),
//       });

//       if (updateRes.ok) {
//         console.log('✅ ESLint comment updated.');
//       } else {
//         const errorText = await updateRes.text();
//         console.error('❌ Failed to post comment.');
//         console.error(`Status: ${createRes.status}`);
//         console.error(`Response: ${errorText}`);
//       }
//     } else {
//       // 4. Post new comment
//       const createRes = await fetch(commentsUrl, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Accept': 'application/vnd.github.v3+json',
//         },
//         body: JSON.stringify({ body: commentBody }),
//       });

//       if (createRes.ok) {
//         console.log('✅ ESLint comment posted.');
//       } else {
//         const errorText = await createRes.text();
//         console.error('❌ Failed to post comment.');
//         console.error(`Status: ${createRes.status}`);
//         console.error(`Response: ${errorText}`);
//       }
//     }
//   } catch (err) {
//     console.error('❌ Error posting/updating comment:', err);
//     process.exit(1);
//   }
// }

// postOrUpdateComment();
