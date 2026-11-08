# Skychat

A private, local chat interface for models running with [Ollama](https://ollama.com). The app calls Ollama at `127.0.0.1:11434`; it does not use a cloud AI service or load remote fonts, scripts, or images.

## Create images locally

Skychat uses [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running on the same computer (`127.0.0.1:8188`) to generate 512 × 512 images. ComfyUI and the image models must be installed on the Skychat host; they are separate from Ollama. Choose between:

- **Realistic Vision 6.0** for photo-style images, with 20 sampling steps. Its fp16 checkpoint is about 2.13 GB and uses the [CreativeML OpenRAIL-M license](https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE). It also uses Stability AI's [SD VAE](https://huggingface.co/stabilityai/sd-vae-ft-mse-original), about 335 MB, under the MIT license. Review both model cards and licenses before use.
- **Stable Diffusion 1.5** for faster generation, using the fp16 checkpoint from [Comfy-Org](https://huggingface.co/Comfy-Org/stable-diffusion-1.5), about 2.13 GB.

Download the models into the matching folders inside your ComfyUI installation. For example, with the ComfyUI folder at `~/Projects/AI/ComfyUI`:

```bash
mkdir -p ~/Projects/AI/ComfyUI/models/checkpoints ~/Projects/AI/ComfyUI/models/vae
curl -L --fail --output ~/Projects/AI/ComfyUI/models/checkpoints/Realistic_Vision_V6.0_NV_B1_fp16.safetensors \
  https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE/resolve/main/Realistic_Vision_V6.0_NV_B1_fp16.safetensors
curl -L --fail --output ~/Projects/AI/ComfyUI/models/vae/vae-ft-mse-840000-ema-pruned.safetensors \
  https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors
```

The Stable Diffusion 1.5 checkpoint must also be present in `models/checkpoints` to use the faster option. Restart ComfyUI after adding model files if they do not appear in its model list, then refresh the image-model status in Skychat. Choose **Create image**, enter a prompt, select the image model, then select **Generate image**. Generated images are also saved by ComfyUI in its `output` folder. This host has CPU-only image generation, so images take several minutes; Realistic Vision is slower. It can improve photographic detail, but no model guarantees flawless faces or anatomy.

## Share on your local network

The app listens on your computer's network interfaces so other devices on your LAN can connect. A shared password is required before the chat or Ollama endpoints are available.

1. Create your local secrets file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and set `SKYCHAT_PASSWORD` to a strong password that you share only with intended users. Generate a separate session-signing secret with:

   ```bash
   openssl rand -hex 32
   ```

   Put the generated value in `SKYCHAT_SESSION_SECRET`. Keep `.env.local` private; it is excluded from Git.

3. Start Ollama. For LAN use, run Skychat in production mode. Stop any running dev server first, then run:

   ```bash
   npm run build
   npm run start
   ```

   The production server listens on all network interfaces. Use `npm run dev` only for local development.

4. Find your computer's LAN IP address:

   - Linux: `hostname -I`
   - Windows: `ipconfig` (look for the IPv4 address of your Wi-Fi or Ethernet adapter)
   - macOS: `ipconfig getifaddr en0` (Wi-Fi; use the relevant interface if needed)

5. On another device connected to the same network, open `http://<computer-LAN-IP>:3000` and enter the shared password. For example: `http://192.168.1.25:3000`.

If another device cannot connect, allow inbound TCP port 3000 for **private/local networks only** in the computer's firewall. Do not configure router port forwarding. The app proxies Ollama on the host computer, so Ollama does not need to be exposed to the LAN. Conversation history remains in each user's own browser.

**Network security:** This setup is intended for a trusted private network. HTTP on a LAN does not encrypt traffic, so use a trusted Wi-Fi network and do not share the password on a public or untrusted network. Use HTTPS or a VPN if you need access over an untrusted network.

## Run it

1. Install Ollama and download at least one model while you have internet access. For example:

   ```bash
   ollama pull llama3.2
   ```

2. Start Ollama. On many systems it runs automatically; otherwise run:

   ```bash
   ollama serve
   ```

3. Install the project dependencies and start the local chat app:

   ```bash
   npm install
   npm run build
   npm run start
   ```

4. Open [http://localhost:3000](http://localhost:3000), enter your shared password, choose one of your installed models, and start chatting.

Once Ollama, the app dependencies, and a model are installed, chatting works without an internet connection. Keep the Ollama service and the local app running. Your conversations are stored in this browser's local storage.

Skychat asks Ollama to keep the selected model ready for 30 minutes after a chat, which can make follow-up responses start faster. The first reply can still take longer while Ollama loads the model into memory; generation speed depends on your computer and the model size.

## Troubleshooting

- **Chat is stuck on “Finding models…” or controls do not respond:** Stop the dev server and run the production commands above. Dev mode relies on a browser WebSocket for hot reload and is not recommended for LAN use.
- **Ollama unavailable:** Start Ollama and make sure its local API is listening at `127.0.0.1:11434`.
- **No models found:** Check installed models with `ollama list`; download one with `ollama pull <model>`, then refresh the model list in Skychat.
- **Model error:** Make sure the selected model is available to the Ollama instance running on this machine.
- **Image generation unavailable:** Start ComfyUI on the host. If the checkpoint was just installed, restart ComfyUI so it can discover the model.

Run a production build with `npm run build`, then serve it locally with `npm run start`.
