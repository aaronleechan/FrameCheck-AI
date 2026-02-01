# FrameCheck AI

A Chrome extension that analyzes YouTube videos for credibility assessment using Google's Gemini AI. Detect misinformation, verify claims, and make informed decisions about the content you watch.

## Features

- **Verify Mode** - Fact-check videos with reliability scores, red flag detection, and source credibility analysis
- **Summary Mode** - Get quick summaries with key points and recommendations
- **Deep Analysis Mode** - Comprehensive 11-section analysis including visual analysis, evidence evaluation, and AI-generated content detection
- **Custom Questions** - Ask specific questions about any video
- **Multi-language Support** - Analysis available in 35+ languages
- **History** - Save and revisit your last 5 analyses
- **Visual Analysis** - Captures video frames for deeper content analysis
- **Transcript Analysis** - Extracts and analyzes video captions when available

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `FrameCheck` folder
6. The extension icon will appear in your toolbar

## Setup

### Get a Free Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key (starts with `AIza...`)
5. Open FrameCheck AI and paste your key in the setup section

The Gemini API has a generous free tier suitable for personal use.

## Usage

1. Navigate to any YouTube video or Short
2. Click the FrameCheck AI extension icon
3. Select an analysis mode:
   - **Verify** - Quick reliability check
   - **Summary** - Brief overview
   - **Analysis** - Full deep analysis
4. Click **Enter** to analyze
5. Optionally, ask custom questions about the video

## Analysis Modes

### Verify
Quick credibility assessment with:
- Reliability verdict (Reliable/Questionable/Unreliable)
- Trust score (1-10)
- Red flags detected
- Source credibility check
- Fact-check summary
- Share recommendation

### Summary
Fast overview including:
- Topic identification
- Key points (3-5 bullets)
- Creator type
- Tone analysis
- Target audience
- Watch recommendation

### Deep Analysis
Comprehensive 11-section report:
1. Content Summary
2. Visual Analysis
3. Source Analysis
4. Purpose Assessment
5. Evidence Evaluation
6. Context Check
7. Cross-Check Guide
8. Opinion vs Fact ratio
9. Reliability Score
10. Claims Analysis
11. AI-Generated Indicators

## Privacy

- All data stored locally in your browser
- No data sent to external servers (except Gemini API for analysis)
- Your API key never leaves your device
- See [PRIVACY.md](PRIVACY.md) for full privacy policy

## Technical Details

- **Manifest Version**: 3
- **Permissions**: `activeTab`, `scripting`, `storage`
- **API**: Google Gemini 2.0 Flash
- **No build step required** - Plain HTML/JS

## Support

- **Suggestions**: aarlic@outlook.com
- **Donate**: [PayPal](https://paypal.me/aarlic)

## License

MIT License - feel free to modify and distribute.

---

Made with AI to fight misinformation.
