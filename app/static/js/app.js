document.addEventListener("DOMContentLoaded", () => {
    const ROOT = document.body.dataset.rootPath || "";

    // State: map of id -> base64
    const selectedImages = new Map();
    let uploadCounter = 0;

    // Elements
    const tabs = document.querySelectorAll(".tab");
    const tabContents = document.querySelectorAll(".tab-content");
    const presetCards = document.querySelectorAll(".image-card:not(.upload-trigger)");
    const gallery = document.querySelector(".image-gallery");
    const fileInput = document.getElementById("file-input");
    const uploadArea = document.getElementById("upload-area");
    const promptInput = document.getElementById("prompt-input");
    const sendBtn = document.getElementById("send-btn");
    const resultSection = document.getElementById("result-section");
    const resultText = document.getElementById("result-text");
    const loader = document.getElementById("loader");
    const errorSection = document.getElementById("error-section");
    const errorText = document.getElementById("error-text");
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");

    // Tabs
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            if (tab.disabled) return;
            tabs.forEach((t) => t.classList.remove("active"));
            tabContents.forEach((tc) => tc.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
        });
    });

    // Update send button state
    function updateSendBtn() {
        sendBtn.disabled = selectedImages.size === 0 || !promptInput.value.trim();
    }

    function autoResize() {
        promptInput.style.height = "auto";
        promptInput.style.height = promptInput.scrollHeight + "px";
    }

    promptInput.addEventListener("input", () => {
        updateSendBtn();
        autoResize();
    });

    // Gemma parameters
    const gemmaTemp = document.getElementById("gemma-temperature");
    const gemmaTempRange = document.getElementById("gemma-temperature-range");
    const gemmaMaxTokens = document.getElementById("gemma-max-tokens");

    gemmaTemp.addEventListener("input", () => {
        gemmaTempRange.value = gemmaTemp.value;
    });

    gemmaTempRange.addEventListener("input", () => {
        gemmaTemp.value = gemmaTempRange.value;
    });

    // Select preset image (toggle)
    presetCards.forEach((card) => {
        card.addEventListener("click", (e) => {
            if (e.target.closest(".zoom-btn")) return;

            const src = card.dataset.src;

            if (card.classList.contains("selected")) {
                card.classList.remove("selected");
                selectedImages.delete(src);
                updateSendBtn();
                return;
            }

            card.classList.add("selected");

            if (selectedImages.has(src)) {
                updateSendBtn();
                return;
            }

            fetch(src)
                .then((r) => r.blob())
                .then((blob) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        selectedImages.set(src, reader.result.split(",")[1]);
                        updateSendBtn();
                    };
                    reader.readAsDataURL(blob);
                });
        });
    });

    // Zoom button — open lightbox
    document.querySelectorAll(".zoom-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const card = btn.closest(".image-card");
            lightboxImg.src = card.dataset.src;
            lightbox.hidden = false;
        });
    });

    // Close lightbox
    lightbox.querySelector(".lightbox-overlay").addEventListener("click", closeLightbox);
    lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    lightboxImg.addEventListener("click", closeLightbox);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLightbox();
    });

    function closeLightbox() {
        lightbox.hidden = true;
    }

    // File upload
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
        fileInput.value = "";
    });

    // Drag and drop
    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            handleFile(file);
        }
    });

    function handleFile(file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const id = `__upload_${++uploadCounter}__`;
            const base64 = reader.result.split(",")[1];
            selectedImages.set(id, base64);

            // Create thumbnail card
            const card = document.createElement("div");
            card.className = "image-card upload-card selected";
            card.dataset.uploadId = id;

            const img = document.createElement("img");
            img.src = reader.result;
            img.alt = "Загруженное изображение";

            const clearBtn = document.createElement("button");
            clearBtn.className = "upload-card-clear";
            clearBtn.title = "Удалить";
            clearBtn.innerHTML = "&#x2715;";
            clearBtn.addEventListener("click", () => {
                selectedImages.delete(id);
                card.remove();
                updateSendBtn();
            });

            card.appendChild(img);
            card.appendChild(clearBtn);
            gallery.insertBefore(card, uploadArea);

            updateSendBtn();
        };
        reader.readAsDataURL(file);
    }

    // Result tabs
    const resultRawJsonText = document.getElementById("result-raw-json-text");
    document.querySelectorAll(".result-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".result-tab").forEach((t) => t.classList.remove("active"));
            document.querySelectorAll(".result-panel").forEach((p) => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(`result-${tab.dataset.result}`).classList.add("active");
        });
    });

    // Send request
    sendBtn.addEventListener("click", async () => {
        if (selectedImages.size === 0 || !promptInput.value.trim()) return;

        resultSection.hidden = true;
        errorSection.hidden = true;
        loader.hidden = false;
        sendBtn.disabled = true;

        try {
            const response = await fetch(`${ROOT}/api/gemma`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    images: Array.from(selectedImages.values()),
                    prompt: promptInput.value.trim(),
                    temperature: parseFloat(gemmaTemp.value),
                    max_output_tokens: gemmaMaxTokens.value ? parseInt(gemmaMaxTokens.value) : null,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Ошибка сервера");
            }

            const data = await response.json();
            resultText.innerHTML = marked.parse(data.result);
            document.getElementById("result-request-json-text").textContent = JSON.stringify(data.request_json, null, 2);
            resultRawJsonText.textContent = JSON.stringify(data.raw_json, null, 2);
            const tokenCount = document.getElementById("token-count");
            if (data.total_tokens != null) {
                const cost = (data.total_tokens / 1000 * 0.4).toFixed(2);
                tokenCount.textContent = `Токенов: ${data.total_tokens} (${cost} ₽)`;
                tokenCount.hidden = false;
            } else {
                tokenCount.hidden = true;
            }
            resultSection.hidden = false;
            resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {
            errorText.textContent = err.message;
            errorSection.hidden = false;
            errorSection.scrollIntoView({ behavior: "smooth", block: "start" });
        } finally {
            loader.hidden = true;
            updateSendBtn();
        }
    });

    // ========== YandexART ==========
    const artPrompt = document.getElementById("art-prompt");
    const artSendBtn = document.getElementById("art-send-btn");
    const artLoader = document.getElementById("art-loader");
    const artError = document.getElementById("art-error");
    const artErrorText = document.getElementById("art-error-text");
    const artResult = document.getElementById("art-result");
    const artResultImg = document.getElementById("art-result-img");
    const artRawJsonText = document.getElementById("art-raw-json-text");
    const artRequestJsonText = document.getElementById("art-request-json-text");
    const aspectBtns = document.querySelectorAll(".aspect-btn");

    const artSeedInput = document.getElementById("art-seed");
    const artSeedRange = document.getElementById("art-seed-range");
    const artSeedRandom = document.getElementById("art-seed-random");

    let artWidthRatio = 1;
    let artHeightRatio = 1;

    function updateArtSendBtn() {
        artSendBtn.disabled = !artPrompt.value.trim();
    }

    // Seed controls
    artSeedRandom.addEventListener("change", () => {
        const disabled = artSeedRandom.checked;
        artSeedInput.disabled = disabled;
        artSeedRange.disabled = disabled;
    });

    artSeedInput.addEventListener("input", () => {
        artSeedRange.value = artSeedInput.value;
    });

    artSeedRange.addEventListener("input", () => {
        artSeedInput.value = artSeedRange.value;
    });

    artPrompt.addEventListener("input", () => {
        updateArtSendBtn();
        artPrompt.style.height = "auto";
        artPrompt.style.height = artPrompt.scrollHeight + "px";
    });

    // Aspect ratio selection
    const aspectCustomBtn = document.getElementById("aspect-custom-btn");
    const aspectCustomInputs = document.getElementById("aspect-custom-inputs");
    const aspectCustomW = document.getElementById("aspect-custom-w");
    const aspectCustomH = document.getElementById("aspect-custom-h");

    aspectBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            aspectBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            if (btn === aspectCustomBtn) {
                aspectCustomInputs.hidden = false;
                artWidthRatio = parseInt(aspectCustomW.value) || 1;
                artHeightRatio = parseInt(aspectCustomH.value) || 1;
            } else {
                aspectCustomInputs.hidden = true;
                artWidthRatio = parseInt(btn.dataset.w);
                artHeightRatio = parseInt(btn.dataset.h);
            }
        });
    });

    aspectCustomW.addEventListener("input", () => {
        artWidthRatio = parseInt(aspectCustomW.value) || 1;
    });

    aspectCustomH.addEventListener("input", () => {
        artHeightRatio = parseInt(aspectCustomH.value) || 1;
    });

    // Result tabs for YandexART
    document.querySelectorAll("[data-art-result]").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll("[data-art-result]").forEach((t) => t.classList.remove("active"));
            document.querySelectorAll("#art-result .result-panel").forEach((p) => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(`art-result-${tab.dataset.artResult}`).classList.add("active");
        });
    });

    // Generated image click — open lightbox
    artResultImg.addEventListener("click", () => {
        if (artResultImg.src) {
            lightboxImg.src = artResultImg.src;
            lightbox.hidden = false;
        }
    });

    // Send YandexART request
    artSendBtn.addEventListener("click", async () => {
        if (!artPrompt.value.trim()) return;

        artResult.hidden = true;
        artError.hidden = true;
        artLoader.hidden = false;
        artSendBtn.disabled = true;

        try {
            const response = await fetch(`${ROOT}/api/yandexart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: artPrompt.value.trim(),
                    width_ratio: artWidthRatio,
                    height_ratio: artHeightRatio,
                    seed: artSeedRandom.checked ? null : artSeedInput.value,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Ошибка сервера");
            }

            const data = await response.json();
            const rawForDisplay = structuredClone(data.raw_json);
            if (rawForDisplay?.response?.image) {
                rawForDisplay.response.image = rawForDisplay.response.image.slice(0, 64) + "…";
            }
            artRawJsonText.textContent = JSON.stringify(rawForDisplay, null, 2);
            artRequestJsonText.textContent = JSON.stringify(data.request_json, null, 2);
            artResult.hidden = false;
            artResultImg.onload = () => {
                artResult.scrollIntoView({ behavior: "smooth", block: "start" });
            };
            artResultImg.src = `data:image/png;base64,${data.image_base64}`;
        } catch (err) {
            artErrorText.textContent = err.message;
            artError.hidden = false;
            artError.scrollIntoView({ behavior: "smooth", block: "start" });
        } finally {
            artLoader.hidden = true;
            updateArtSendBtn();
        }
    });
});
