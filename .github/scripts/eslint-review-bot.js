const fs = require('fs');
const fetch = require('node-fetch');

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;

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

eslintReport.forEach(file => {
  if (file.messages.length > 0) {
    commentBody += `**${file.filePath}**\n`;
    file.messages.forEach(msg => {
      const emoji = msg.severity === 2 ? '❌ Error' : '⚠️ Warning';
      commentBody += `- [${emoji}] Line ${msg.line}: ${msg.message} (${msg.ruleId})\n`;
    });
    commentBody += '\n';
  }
});

const apiBase = `https://api.github.com/repos/${owner}/${repoName}`;
const commentsUrl = `${apiBase}/issues/${prNumber}/comments`;

async function postOrUpdateComment() {
  try {
    // 1. Get existing comments
    const res = await fetch(commentsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const comments = await res.json();

    // 2. Look for a previous ESLint comment
    const existing = comments.find(comment =>
      comment.user.type === 'Bot' &&
      comment.body.startsWith('### 🔍 ESLint Issues Found:')
    );

    if (existing) {
      // 3. Update existing comment
      const updateRes = await fetch(`${apiBase}/issues/comments/${existing.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ body: commentBody }),
      });

      if (updateRes.ok) {
        console.log('✅ ESLint comment updated.');
      } else {
        console.error('❌ Failed to update comment.');
      }
    } else {
      // 4. Post new comment
      const createRes = await fetch(commentsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ body: commentBody }),
      });

      if (createRes.ok) {
        console.log('✅ ESLint comment posted.');
      } else {
        console.error('❌ Failed to post comment.');
      }
    }
  } catch (err) {
    console.error('❌ Error posting/updating comment:', err);
    process.exit(1);
  }
}

postOrUpdateComment();
