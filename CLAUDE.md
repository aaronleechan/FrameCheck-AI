# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FrameCheck AI is a Chrome extension (Manifest V3) that analyzes YouTube video metadata using the Google Gemini API to detect opinion vs fact, source presence, and AI-generated content indicators.

## Architecture

- **manifest.json**: Extension configuration with `activeTab`, `scripting` permissions and host permission for Gemini API
- **popup.html**: Extension popup UI with analyze button and results display
- **popup.js**: Core logic that:
  1. Injects a script into the active YouTube tab to extract video metadata (title, channel, description) from DOM/meta tags
  2. Sends metadata to Gemini 2.0 Flash API for analysis
  3. Displays formatted results in the popup

## Development

To test the extension:
1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. Navigate to a YouTube video and click the extension icon

No build step required - plain HTML/JS that runs directly in Chrome.

## Key Implementation Details

- Uses `chrome.scripting.executeScript` to inject metadata extraction into YouTube pages
- Supports both regular YouTube videos (`/watch`) and Shorts (`/shorts/`)
- API key is hardcoded in popup.js (line 1)
- Handles rate limiting (429) with user-friendly messages
