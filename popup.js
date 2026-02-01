// ==================== API Key Management ====================

let API_KEY = null;
let currentVideoUrl = null;

// DOM Elements for API Key
const apiSectionNoKey = document.getElementById('apiSectionNoKey');
const apiSectionHasKey = document.getElementById('apiSectionHasKey');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyMasked = document.getElementById('apiKeyMasked');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const editApiKeyBtn = document.getElementById('editApiKeyBtn');
const deleteApiKeyBtn = document.getElementById('deleteApiKeyBtn');
const settingsToggle = document.getElementById('settingsToggle');
const mainFeatures = document.getElementById('mainFeatures');

// All interactive elements that should be disabled without API key
const featureElements = [
  'analysisMode', 'languageSelect', 'analyzeBtn', 'customQuestion',
  'askBtn', 'saveHistoryCheckbox', 'clearHistoryBtn'
];

// Initialize API Key on load
(async function initApiKey() {
  const data = await chrome.storage.local.get(['geminiApiKey']);
  if (data.geminiApiKey) {
    API_KEY = data.geminiApiKey;
    showHasKeyUI();
  } else {
    showNoKeyUI();
  }
})();

function showNoKeyUI() {
  apiSectionNoKey.style.display = 'block';
  apiSectionHasKey.style.display = 'none';
  apiKeyInput.value = '';
  disableFeatures();
}

function showHasKeyUI() {
  apiSectionNoKey.style.display = 'none';
  apiSectionHasKey.style.display = 'block';
  // Mask the API key: show first 4 and last 4 characters
  if (API_KEY) {
    const masked = API_KEY.substring(0, 4) + '...' + API_KEY.substring(API_KEY.length - 4);
    apiKeyMasked.textContent = masked;
  }
  enableFeatures();
}

function disableFeatures() {
  mainFeatures.classList.add('features-disabled');
  featureElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  document.getElementById('result').innerHTML =
    '<span style="color: #856404;">Add your API key above to start analyzing videos.</span>';
}

function enableFeatures() {
  mainFeatures.classList.remove('features-disabled');
  featureElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  // Don't overwrite result if we have cached content
  const resultDiv = document.getElementById('result');
  if (!resultDiv.dataset.cached) {
    resultDiv.innerText = 'Navigate to a YouTube video and click Analyze.';
  }
}

// ==================== Result Caching ====================

// Cache result for the current video
async function cacheResult(videoUrl, resultHtml) {
  await chrome.storage.local.set({
    cachedResult: {
      url: videoUrl,
      html: resultHtml,
      timestamp: Date.now()
    }
  });
}

// Restore cached result if on same video
async function restoreCachedResult() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url) return;

    currentVideoUrl = tab.url;

    // Only restore for YouTube videos
    if (!tab.url.includes("youtube.com/watch") && !tab.url.includes("youtube.com/shorts/")) {
      return;
    }

    const data = await chrome.storage.local.get(['cachedResult']);
    if (data.cachedResult && data.cachedResult.url === tab.url) {
      const resultDiv = document.getElementById('result');
      resultDiv.innerHTML = data.cachedResult.html;
      resultDiv.dataset.cached = 'true';
    }
  } catch (e) {
    console.log('Could not restore cached result:', e);
  }
}

// Initialize cached result on popup load
restoreCachedResult();

// Save API Key
saveApiKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    alert('Please enter an API key');
    return;
  }
  if (!key.startsWith('AIza')) {
    alert('Invalid API key format. Gemini API keys start with "AIza"');
    return;
  }

  API_KEY = key;
  await chrome.storage.local.set({ geminiApiKey: key });
  showHasKeyUI();
});

// Edit API Key
editApiKeyBtn.addEventListener('click', () => {
  apiSectionNoKey.style.display = 'block';
  apiSectionHasKey.style.display = 'none';
  apiKeyInput.value = API_KEY || '';
  apiKeyInput.type = 'text'; // Show the key when editing
  apiKeyInput.focus();
  apiKeyInput.select();
});

// Delete API Key
deleteApiKeyBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete your API key?')) {
    API_KEY = null;
    await chrome.storage.local.remove(['geminiApiKey']);
    showNoKeyUI();
    disableFeatures();
  }
});

// Toggle settings visibility (for users who have key and want to hide/show)
let settingsVisible = true;
settingsToggle.addEventListener('click', () => {
  settingsVisible = !settingsVisible;
  if (API_KEY) {
    apiSectionHasKey.style.display = settingsVisible ? 'block' : 'none';
  } else {
    apiSectionNoKey.style.display = settingsVisible ? 'block' : 'none';
  }
});

// Helper function to check API key before operations
function checkApiKey() {
  if (!API_KEY) {
    document.getElementById('result').innerHTML =
      '<strong>API Key Required</strong><br>Please add your Gemini API key above to use FrameCheck AI.';
    return false;
  }
  return true;
}

// ==================== Main Analysis ====================

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');

  if (!checkApiKey()) return;

  const selectedLanguage = document.getElementById('languageSelect').value;
  const analysisMode = document.getElementById('analysisMode').value;
  const modeLabels = { verify: 'Verify', summary: 'Summary', deep: 'Deep Analysis' };
  resultDiv.innerText = `Running ${modeLabels[analysisMode]}... Capturing video data.`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("youtube.com/watch") && !tab.url.includes("youtube.com/shorts/")) {
      resultDiv.innerText = "Please open a YouTube video or Short.";
      return;
    }

    // injected script to get metadata, transcript, and video frames
    const parsedData = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        // Capture frames from video player
        const captureVideoFrames = async (numFrames = 4) => {
          const video = document.querySelector('video');
          if (!video || video.readyState < 2) return [];

          const frames = [];
          const duration = video.duration;
          const currentTime = video.currentTime;

          // Capture frames at different points in the video
          const timestamps = [];
          for (let i = 0; i < numFrames; i++) {
            // Spread frames across the video, avoiding very start/end
            timestamps.push(Math.min(duration * 0.1 + (duration * 0.8 * i / (numFrames - 1)), duration - 1));
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 640;  // Reasonable size for analysis
          canvas.height = 360;

          for (const ts of timestamps) {
            try {
              video.currentTime = ts;
              await new Promise(resolve => {
                video.onseeked = resolve;
                setTimeout(resolve, 500); // Fallback timeout
              });

              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              frames.push({
                timestamp: ts,
                image: dataUrl.split(',')[1] // Base64 without prefix
              });
            } catch (e) {
              console.log('Frame capture error:', e);
            }
          }

          // Restore original position
          video.currentTime = currentTime;
          return frames;
        };

        // Try to get data from meta tags first as they are consistent across views
        const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || "";

        // DOM Fallbacks
        const domTitle = document.querySelector("#title h1")?.innerText;
        // For shorts, the active video is in a specific container
        const activeShort = document.querySelector('ytd-reel-video-renderer[is-active]');
        const shortTitle = activeShort?.querySelector('.generated-headline-text')?.innerText; // NOTE: Selectors change often, relying on meta is safer

        const title = getMeta("title") || domTitle || shortTitle || document.title;
        const description = getMeta("description") || "";

        // Channel
        let channel = document.querySelector('link[itemprop="name"]')?.getAttribute("content") || "";
        if (!channel) {
          channel = document.querySelector("#channel-name a")?.innerText ||
            activeShort?.querySelector('ytd-channel-name a')?.innerText || "";
        }

        // Get subscriber count for credibility assessment
        const subscriberCount = document.querySelector("#owner-sub-count")?.innerText ||
          document.querySelector("yt-formatted-string#owner-sub-count")?.innerText || "";

        // Get video stats (views, likes)
        const viewCount = document.querySelector("span.view-count")?.innerText ||
          document.querySelector("ytd-video-view-count-renderer span")?.innerText || "";

        // Try to extract transcript from YouTube's captions
        let transcript = "";
        try {
          // Get video ID from URL
          const urlParams = new URLSearchParams(window.location.search);
          const videoId = urlParams.get('v') || window.location.pathname.split('/shorts/')[1];

          if (videoId) {
            // Fetch the video page to get caption track URL
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
            const html = await response.text();

            // Extract caption track URL from ytInitialPlayerResponse
            const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
            if (captionMatch) {
              const captionTracks = JSON.parse(captionMatch[1]);
              if (captionTracks.length > 0) {
                // Prefer English, fall back to first available
                const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];
                const captionUrl = track.baseUrl;

                // Fetch the caption XML
                const captionResponse = await fetch(captionUrl);
                const captionXml = await captionResponse.text();

                // Parse XML and extract text
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(captionXml, "text/xml");
                const textElements = xmlDoc.querySelectorAll("text");
                transcript = Array.from(textElements)
                  .map(el => el.textContent)
                  .join(" ")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .substring(0, 8000); // Limit to avoid token limits
              }
            }
          }
        } catch (e) {
          console.log("Could not fetch transcript:", e);
        }

        // Capture video frames for visual analysis
        const frames = await captureVideoFrames(4);

        return { title, description, channel, subscriberCount, viewCount, transcript, frames };
      }
    });

    const metadata = parsedData[0].result;

    // Fallback if extraction failed significantly
    if (!metadata.title) {
      metadata.title = "Unknown Title";
    }

    const hasTranscript = metadata.transcript && metadata.transcript.length > 100;
    const hasFrames = metadata.frames && metadata.frames.length > 0;

    // Generate prompt based on analysis mode
    const prompt = generatePrompt(analysisMode, metadata, tab.url, hasTranscript, hasFrames, selectedLanguage);

    const statusParts = [];
    if (hasFrames) statusParts.push(`${metadata.frames.length} video frames captured`);
    if (hasTranscript) statusParts.push("transcript found");
    resultDiv.innerText = statusParts.length > 0
      ? `${statusParts.join(", ")}! Running deep AI analysis...`
      : "Analyzing metadata only (no frames or transcript available)...";

    // Build multimodal request with text and images
    const parts = [{ text: prompt }];

    // Add video frames as images for visual analysis
    if (hasFrames) {
      for (const frame of metadata.frames) {
        parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: frame.image
          }
        });
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }]
      })
    });

    if (response.status === 429) {
      resultDiv.innerHTML = "<strong>API Quota Exceeded</strong><br>The free tier limit has been reached.<br>Please wait a minute and try again.";
      return;
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    const aiText = data.candidates[0].content.parts[0].text;

    // Simple formatting for the UI
    const formattedResult = formatResponse(aiText);
    resultDiv.innerHTML = formattedResult;
    resultDiv.dataset.cached = 'true';

    // Cache the result for this video
    await cacheResult(tab.url, formattedResult);

    // Save to history if enabled
    if (document.getElementById('saveHistoryCheckbox').checked) {
      await saveToHistory({
        type: 'analysis',
        analysisMode: analysisMode,
        videoUrl: tab.url,
        videoTitle: metadata.title,
        result: aiText,
        timestamp: Date.now()
      });
    }

  } catch (error) {
    if (error.message.includes("Quota exceeded")) {
      resultDiv.innerHTML = "<strong>API Quota Exceeded</strong><br>Please wait a few moments before trying again.";
    } else {
      resultDiv.innerText = "Error: " + error.message;
    }
  }
});

function formatResponse(text) {
  // Convert markdown-style bolding to HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// Generate prompt based on analysis mode
function generatePrompt(mode, metadata, url, hasTranscript, hasFrames, language) {
  const videoInfo = `
    **Video Info:**
    - Title: ${metadata.title}
    - Channel: ${metadata.channel}
    - Subscribers: ${metadata.subscriberCount || 'Unknown'}
    - Views: ${metadata.viewCount || 'Unknown'}
    - Description: ${metadata.description}
    - URL: ${url}
    ${hasTranscript ? `
    **Transcript (partial):**
    ${metadata.transcript}
    ` : ''}
    ${hasFrames ? `
    **Video Frames:** ${metadata.frames.length} frames from the video are attached for visual analysis.
    ` : ''}
  `;

  const languageInstruction = `**IMPORTANT: Respond entirely in ${language}. All section headers and content must be in ${language}.**`;

  if (mode === 'verify') {
    return `
      You are a fact-checker and content verification expert. Analyze this YouTube video to determine if the content is reliable and trustworthy.

      ${videoInfo}

      **IMPORTANT FORMAT: Each section title MUST include a 1-2 word verdict in brackets for quick scanning.**

      Provide a VERIFICATION REPORT with these sections:

      1. **Reliability Verdict [RELIABLE / QUESTIONABLE / UNRELIABLE]**: Overall assessment in one word, then explain in 1-2 sentences.

      2. **Trust Score [X/10]**: Rate from 1-10 with brief justification.

      3. **Red Flags Detected [None / Minor / Major]**:
         - Clickbait or sensationalism?
         - Emotional manipulation tactics?
         - Conspiracy theory markers?
         - Misleading claims?
         - Missing context?

      4. **Source Credibility [Verified / Unverified / Anonymous]**:
         - Is the creator identifiable and accountable?
         - Do they have expertise on this topic?
         - Any conflicts of interest?

      5. **Evidence Check [Strong / Weak / None]**:
         - Are claims backed by evidence?
         - Are sources cited?
         - Can claims be independently verified?

      6. **Fact-Check Summary**:
         - List 2-3 main claims and whether they appear true, false, or unverifiable
         - Note any misleading or out-of-context information

      7. **Recommendation [Safe to Share / Use Caution / Do Not Share]**: Final recommendation for viewers.

      Keep responses concise and focused on verification.

      ${languageInstruction}
    `;
  }

  if (mode === 'summary') {
    return `
      Provide a quick, concise summary of this YouTube video.

      ${videoInfo}

      **IMPORTANT FORMAT: Each section title MUST include a brief verdict in brackets.**

      Provide a QUICK SUMMARY with these sections:

      1. **Topic [1-3 words]**: What is this video about?

      2. **Key Points**: List 3-5 main takeaways as bullet points.

      3. **Creator [Type]**: Who made this? (News outlet / Individual creator / Organization / Anonymous)

      4. **Tone [Informative / Opinion / Entertainment / Promotional]**: What's the overall tone?

      5. **Target Audience**: Who is this video for?

      6. **Quick Take**: One sentence summary a viewer should know before watching.

      7. **Worth Watching? [Yes / Maybe / No]**: Brief recommendation based on content quality.

      Keep the entire response SHORT and SCANNABLE. No lengthy paragraphs.

      ${languageInstruction}
    `;
  }

  // Deep Analysis (default) - full 11-section analysis
  return `
    Analyze this YouTube video based on its metadata${hasTranscript ? ', transcript' : ''}${hasFrames ? ' and video frames' : ''}:

    ${videoInfo}

    Please provide a structured analysis with these sections.

    **IMPORTANT FORMAT: Each section title MUST include a 1-2 word verdict/summary in brackets for quick scanning.**
    Example formats:
    - "**Content Summary [Politics/Election]**"
    - "**Source Analysis [Unverified]**"
    - "**Evidence Evaluation [Weak]**"
    - "**Opinion vs Fact [80% Opinion]**"
    - "**Reliability Score [3/10 - Low]**"

    1. **Content Summary**: What is this video actually discussing? (2-3 sentences)

    2. **Visual Analysis**: ${hasFrames ? 'Based on the video frames: What type of content is shown (talking head, slideshow, footage, animation)? Any on-screen text, graphics, or visual credibility indicators?' : 'No frames available.'}

    3. **Source Analysis**:
       - Who is the creator/channel? What is their background or expertise?
       - Do they have credentials or authority on this topic?
       - Is this an individual, organization, news outlet, or anonymous account?
       - Any affiliations, sponsors, or potential conflicts of interest?

    4. **Purpose Assessment**:
       - What appears to be the primary intent? (inform, persuade, entertain, sell, provoke)
       - Is there a clear agenda or bias?
       - Who is the target audience?
       - Is there a call to action (subscribe, buy, vote, share)?

    5. **Evidence Evaluation**:
       - What evidence is presented to support the claims?
       - Are sources cited or referenced?
       - Is data/statistics provided? Are they verifiable?
       - Are expert opinions included? Are they credible experts?
       - Quality of evidence: Strong / Moderate / Weak / None

    6. **Context Check**:
       - Is important context missing or omitted?
       - Is the information presented in proper historical/social context?
       - Are there alternative perspectives not mentioned?
       - Is the timing of this video relevant (tied to current events)?

    7. **Cross-Check Guide**:
       - Suggest 2-3 specific ways to verify the main claims
       - Recommend reliable sources to cross-reference
       - What keywords should viewers search to fact-check?
       - Are there known fact-check articles on this topic?

    8. **Opinion vs Fact**: Is this content primarily factual reporting or opinion/commentary? What percentage would you estimate is opinion vs verifiable facts?

    9. **Source Reliability Score**:
       - Red flags detected (sensationalism, clickbait, conspiracy markers, emotional manipulation)?
       ${hasFrames ? '- Visual credibility cues (professional production, stock footage, manipulated imagery)?' : ''}
       - Overall Reliability Score: Rate 1-10 (1=highly unreliable, 10=highly credible)
       - Confidence level in this assessment: High / Medium / Low

    10. **Claims Analysis**: ${hasTranscript ? 'List 2-3 key claims made in the video and whether they appear verifiable.' : 'Based on title/description, what claims might this video make?'}

    11. **AI Generated Indicators**: Any signs this content is AI-generated (synthetic voice, AI-generated visuals, deepfake indicators, repetitive patterns, disclosure)?

    Keep each section concise but informative.

    ${languageInstruction}
  `;
}

// Word count for custom question
const questionInput = document.getElementById('customQuestion');
const wordCountSpan = document.getElementById('wordCount');

questionInput.addEventListener('input', () => {
  const words = questionInput.value.trim().split(/\s+/).filter(w => w.length > 0);
  const count = words.length;
  wordCountSpan.textContent = count;
  wordCountSpan.parentElement.classList.toggle('limit', count > 50);
});

// Custom question handler
document.getElementById('askBtn').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');

  if (!checkApiKey()) return;

  const selectedLanguage = document.getElementById('languageSelect').value;
  const question = questionInput.value.trim();

  // Validate question
  if (!question) {
    resultDiv.innerText = "Please enter a question about the video.";
    return;
  }

  const words = question.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 50) {
    resultDiv.innerText = "Question too long. Please limit to 50 words.";
    return;
  }

  resultDiv.innerText = "Fetching video data...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("youtube.com/watch") && !tab.url.includes("youtube.com/shorts/")) {
      resultDiv.innerText = "Please open a YouTube video or Short.";
      return;
    }

    // Get video metadata (simplified version for quick questions)
    const parsedData = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || "";
        const title = getMeta("title") || document.querySelector("#title h1")?.innerText || document.title;
        const description = getMeta("description") || "";
        let channel = document.querySelector('link[itemprop="name"]')?.getAttribute("content") ||
                      document.querySelector("#channel-name a")?.innerText || "";

        // Try to get transcript
        let transcript = "";
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const videoId = urlParams.get('v') || window.location.pathname.split('/shorts/')[1];
          if (videoId) {
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
            const html = await response.text();
            const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
            if (captionMatch) {
              const captionTracks = JSON.parse(captionMatch[1]);
              if (captionTracks.length > 0) {
                const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];
                const captionResponse = await fetch(track.baseUrl);
                const captionXml = await captionResponse.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(captionXml, "text/xml");
                transcript = Array.from(xmlDoc.querySelectorAll("text"))
                  .map(el => el.textContent)
                  .join(" ")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .substring(0, 8000);
              }
            }
          }
        } catch (e) {}

        return { title, description, channel, transcript };
      }
    });

    const metadata = parsedData[0].result;
    const hasTranscript = metadata.transcript && metadata.transcript.length > 100;

    resultDiv.innerText = "AI is answering your question...";

    const prompt = `
      You are analyzing a YouTube video to answer a user's specific question.

      **Video Info:**
      - Title: ${metadata.title}
      - Channel: ${metadata.channel}
      - Description: ${metadata.description}
      - URL: ${tab.url}
      ${hasTranscript ? `
      **Transcript:**
      ${metadata.transcript}
      ` : ''}

      **User's Question:** ${question}

      Please answer this question directly and concisely based on the video information provided.
      If the answer cannot be determined from the available information, say so honestly.

      **Respond in ${selectedLanguage}.**
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (response.status === 429) {
      resultDiv.innerHTML = "<strong>API Quota Exceeded</strong><br>Please wait a minute and try again.";
      return;
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const aiText = data.candidates[0].content.parts[0].text;
    const formattedResult = `<strong>Q: ${question}</strong><br><br>${formatResponse(aiText)}`;
    resultDiv.innerHTML = formattedResult;
    resultDiv.dataset.cached = 'true';

    // Cache the result for this video
    await cacheResult(tab.url, formattedResult);

    // Save to history if enabled
    if (document.getElementById('saveHistoryCheckbox').checked) {
      await saveToHistory({
        type: 'question',
        videoUrl: tab.url,
        videoTitle: metadata.title,
        question: question,
        answer: aiText,
        timestamp: Date.now()
      });
    }

  } catch (error) {
    resultDiv.innerText = "Error: " + error.message;
  }
});

// ==================== History Functions ====================

const historyCheckbox = document.getElementById('saveHistoryCheckbox');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Load saved settings and history on popup open
(async function initHistory() {
  const data = await chrome.storage.local.get(['saveHistory', 'history']);

  // Restore checkbox state
  if (data.saveHistory) {
    historyCheckbox.checked = true;
    historySection.style.display = 'block';
  }

  // Render history
  renderHistory(data.history || []);
})();

// Toggle history saving
historyCheckbox.addEventListener('change', async () => {
  await chrome.storage.local.set({ saveHistory: historyCheckbox.checked });
  historySection.style.display = historyCheckbox.checked ? 'block' : 'none';

  if (historyCheckbox.checked) {
    const data = await chrome.storage.local.get(['history']);
    renderHistory(data.history || []);
  }
});

// Save item to history (max 5 items)
async function saveToHistory(item) {
  const data = await chrome.storage.local.get(['history']);
  let history = data.history || [];

  // Add new item at the beginning
  history.unshift(item);

  // Keep only last 5 items
  if (history.length > 5) {
    history = history.slice(0, 5);
  }

  await chrome.storage.local.set({ history });
  renderHistory(history);
}

// Render history list
function renderHistory(history) {
  if (!history || history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No saved history</div>';
    return;
  }

  historyList.innerHTML = history.map((item, index) => {
    const title = item.videoTitle || 'Unknown Video';
    const truncatedTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;
    const modeLabels = { verify: 'Verify', summary: 'Summary', deep: 'Deep Analysis' };
    const typeLabel = item.type === 'analysis'
      ? (modeLabels[item.analysisMode] || 'Analysis')
      : 'Q&A';
    const questionText = item.question ? `"${item.question}"` : '';

    return `
      <div class="history-item" data-index="${index}">
        <div class="video-title">${truncatedTitle}</div>
        <div class="history-type">${typeLabel}</div>
        ${questionText ? `<div class="history-question">${questionText}</div>` : ''}
      </div>
    `;
  }).join('');

  // Add click handlers
  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', async () => {
      const index = parseInt(el.dataset.index);
      const data = await chrome.storage.local.get(['history']);
      const item = data.history[index];

      if (item) {
        const resultDiv = document.getElementById('result');
        const linkHtml = `<a href="${item.videoUrl}" target="_blank" style="color: #3498db; font-size: 12px;">Open video</a>`;

        if (item.type === 'analysis') {
          resultDiv.innerHTML = `<strong>${item.videoTitle}</strong><br>${linkHtml}<br><br>${formatResponse(item.result)}`;
        } else {
          resultDiv.innerHTML = `<strong>${item.videoTitle}</strong><br>${linkHtml}<br><br><strong>Q: ${item.question}</strong><br><br>${formatResponse(item.answer)}`;
        }
      }
    });
  });
}

// Clear history
clearHistoryBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ history: [] });
  renderHistory([]);
});