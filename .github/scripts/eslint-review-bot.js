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
    
    const files = await res.json();
    return files;
  } catch (err) {
    console.error('❌ Error fetching PR diff:', err);
    process.exit(1);
  }
}

async function postInlineComment(file, msg, diffData) {
  try {
    const commitSha = diffData.sha;
    const filePath = file.filePath;

    if(!diffData){
      console.log(`✅ File not found in PR diff: ${filePath}`);
      return;
    }

    // Find the position of the issue in the diff
    const diffFile = diffData.find(file => file.filename === filePath);
    if (!diffFile) {
      console.log(`✅ File not found in PR diff: ${filePath}`);
      return;
    }

    // Calculate position based on diff changes
    const lineNumber = msg.line;
    let position = null;

    for (const hunk of diffFile.hunks) {
      for (const change of hunk.changes) {
        // Ensure we match a line in the diff
        if (change.line === lineNumber) {
          position = change.position;
          break;
        }
      }
    }

    if (position === null) {
      console.error(`❌ Couldn't find position for line ${lineNumber} in the diff.`);
      return;
    }

    const commentBody = `⚠️ [${msg.ruleId}] ${msg.message}`;

    const createRes = await fetch(`${apiBase}/pulls/${prNumber}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        body: commentBody,
        commit_id: commitSha,
        path: filePath,
        position: position,
      }),
    });

    if (createRes.ok) {
      console.log(`✅ Comment posted on ${filePath} line ${lineNumber}`);
    } else {
      const errorText = await createRes.text();
      console.error(`❌ Failed to post comment: ${errorText}`);
    }
  } catch (err) {
    console.error('❌ Error posting inline comment:', err);
  }
}

async function postInlineComments() {
  const diffData = await getPRDiff();
  for (const file of eslintReport) {
    if (file.messages.length > 0) {
      for (const msg of file.messages) {
        if (msg.severity === 2 || msg.severity === 1) {
          await postInlineComment(file, msg, diffData);
        }
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
