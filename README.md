# SnapSort

<div align="center">
  <img src="assets/logo.png" alt="SnapSort Logo" width="200" />
</div>

> Stop drowning in chaotic image folders. Let AI sort them for you.

A beautiful desktop app that uses Google's Gemini AI to automatically categorize and organize your images. No more manual sorting through thousands of photos, screenshots, and memes.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### **Smart AI Categorization**
- Uses Google's latest Gemini models (2.5-flash or 2.5-flash-lite)
- Understands context, not just colors and shapes
- Distinguishes between a photo of a laptop and a laptop screenshot
- Actually works on real-world messy image collections

### **Two Modes for Different Needs**

**Manual Mode**  
You define the categories. Perfect for specific projects like:
- "Vacation", "Work Docs", "Receipts"
- "Before Photos", "After Photos"
- Whatever makes sense for YOUR workflow

**Auto Mode**  
AI decides the categories based on what it sees:
- Screenshots, Documents, Art
- People, Nature, Food, Architecture
- Animals, Objects, and more
- Automatically adapts to your image collection

### **Blazing Fast Performance**
- Processes multiple images in parallel (1-5 concurrent)
- Smart caching: analyzed images are remembered forever
- Lazy loading: only loads images when you scroll to them
- Async everything: UI never freezes, even with 10,000+ images

### **Smart Handling**
- **Copy Mode**: Keep originals untouched, create organized copies
- **Move Mode**: Reorganize in place, save disk space
- Automatic duplicate naming (no overwrites!)
- Creates `OrganizedImages` folder with category subfolders

### **Privacy First**
- Everything runs locally on your machine
- Your API key stays in your browser's localStorage only
- Images are never uploaded except to Gemini for analysis
- No telemetry, no tracking, no nonsense

---

## Quick Start

### Prerequisites
- macOS (Apple Silicon or Intel)
- Node.js 16+ (only for development)
- [Gemini API key](https://aistudio.google.com/app/apikey) (free tier works great!)

### Installation

#### Option 1: Download Pre-built App (Easiest)

**Download from [GitHub Releases](https://github.com/YOUR_USERNAME/SnapSort/releases)**

1. Download `SnapSort-1.0.0-arm64.dmg`
2. Open the DMG and drag SnapSort to Applications
3. **First Launch Fix** - macOS will show a security warning. This is normal for apps outside the App Store. Choose one:

   **Option A: Terminal Command (Fastest)**
   ```bash
   sudo xattr -cr /Applications/SnapSort.app
   ```
   
   **Option B: Right-Click Method**
   - Right-click SnapSort in Applications → Open → Open
   
   **Option C: System Settings**
   - Try to open SnapSort (it will be blocked)
   - Go to System Settings → Privacy & Security
   - Click "Open Anyway"

4. Launch and enjoy! (Only needed once)

#### Option 2: Run from Source
```bash
# Clone or download this repo
cd image_manager

# Install dependencies
npm install

# Run the app
npm start
```

### First Run

1. **Get your Gemini API key**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click "Create API Key"
   - Copy it (it's free for personal use!)

2. **Launch the app**
   - Paste your API key in the field
   - Choose your model (flash-lite is faster, flash is more accurate)
   - Set concurrency (3 is a sweet spot)

3. **Select a folder**
   - Click "Select Folder"
   - Navigate to your chaotic image collection
   - Watch it scan (usually takes seconds)

4. **Choose your mode**
   - **Auto Mode**: Let AI decide categories
   - **Manual Mode**: Edit the category list (one per line)

5. **Hit "Start Analyzing"**
   - Grab a coffee if you have thousands of images
   - Or just watch the satisfying progress bar fill up

6. **Apply your organization**
   - Review the category summary
   - Choose Copy or Move
   - Click Apply
   - Done! ✨

---

## Usage Tips

### Getting the Best Results

**For Mixed Collections**  
Use Auto Mode. It's surprisingly good at figuring out what you have.

**For Specific Projects**  
Use Manual Mode with custom categories like:
```
client-mockups
final-renders
reference-images
rejected
```

**Adjust Concurrency**
- 1-2 parallel: Slower, gentler on API limits
- 3: Perfect balance (recommended)
- 4-5: Maximum speed, burns through API quota faster

**Processing Large Collections**
- The first run takes time (AI analysis)
- Subsequent runs are instant thanks to persistent caching
- Cache survives app restarts and holds up to 10,000 entries

### Keyboard Shortcuts
- None yet! (This could be a great contribution)

---

## How It Works

1. **Scanning**: Recursively finds all images (JPG, PNG, WEBP, GIF)
2. **Preview**: Generates lazy-loaded thumbnails
3. **Analysis**: 
   - Downscales images to optimize API usage
   - Sends to Gemini with smart prompts
   - Caches results locally
4. **Organization**: Creates category folders and copies/moves files
5. **Done**: Your images are beautifully organized!

---

## Tech Stack

**Frontend**
- Vanilla JavaScript (no framework bloat)
- Modern CSS with CSS Grid
- Native Web APIs (IntersectionObserver, File System Access)

**Backend**
- Electron for native desktop experience
- Node.js filesystem APIs
- Gemini AI API

**Performance**
- Async/await everywhere
- Promise pools for concurrency
- Document fragments for DOM batching
- Persistent localStorage caching
- Lazy image loading with IntersectionObserver

---

## Build Your Own

Want to customize or distribute?

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production (macOS)
npm run dist
```

The built app appears in the `dist` folder.

### Customization Ideas
- Add your own category presets
- Change the UI theme
- Add support for videos
- Integrate different AI models
- Add batch rename functionality

---

## Common Questions

**Why does macOS say "SnapSort is damaged" or block it?**  
This is normal for apps downloaded from outside the Mac App Store. Apple requires a $99/year developer certificate to skip this warning. Just run `sudo xattr -cr /Applications/SnapSort.app` in Terminal (or use the right-click method above). You only need to do this once!

**Does this work on Windows/Linux?**  
Not yet! The build is currently macOS-only, but the code should work on other platforms with minimal changes. PRs welcome!

**How much does the Gemini API cost?**  
The free tier is generous (50 requests/day). For heavy use, paid tiers are cheap (~$0.0001 per image).

**What happens to my images?**  
They stay on your computer. Only downscaled versions (max 1280px) are sent to Gemini for analysis.

**Can I use my own categories?**  
Absolutely! Switch to Manual Mode and list whatever categories you want.

**What if it miscategorizes something?**  
You can always move files manually after. AI is smart but not perfect. The more specific your categories, the better it does.

**Does this delete my original images?**  
Only if you choose "Move" mode. "Copy" mode keeps everything safe and creates organized duplicates.

**Can I run this on a folder with 50,000 images?**  
Technically yes, but it'll take a while. Consider organizing in batches or increasing concurrency.

---

## Known Issues

- Browser version requires Chrome/Edge (File System Access API)
- Very large images (>10MB) take longer to downscale
- Electron app is macOS only for now

---

## Roadmap

- [ ] Windows and Linux builds
- [ ] Drag-and-drop folder selection
- [ ] Undo functionality
- [ ] Custom keyboard shortcuts
- [ ] Video support
- [ ] Batch rename tool
- [ ] Export/import category presets
- [ ] Multi-language support

---

## Contributing

Found a bug? Have an idea? Contributions are welcome!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Final Thoughts

This app was built out of frustration with messy image folders and the tedious manual work of organizing them. If it saves you even an hour of mindless clicking and dragging, it was worth making.

Found it useful? Star the repo! Have ideas? Open an issue! Want to contribute? PRs are always welcome!

**Happy organizing!**

---

*Built with ☕ and a deep hatred for disorganized folders*

