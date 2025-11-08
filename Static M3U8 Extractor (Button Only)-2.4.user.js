// ==UserScript==
// @name         Static M3U8 Extractor (No Dev Permission)
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  提取 M3U8 链接，只显示一个可拖动复制按钮（无需开发者权限）
// @match        *://*.girigirilove.com/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const URL_PATTERN = /https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/gi;
    const TARGET_HOST = 'm3u8.girigirilove.com';
    const REMOVE_PREFIX = /^https:\/\/m3u8\.girigirilove\.com\/addons\/aplyer\/atom\.php\?key=0&url=/;
    let foundUrls = new Set();

    // 扫描DOM
    function scanDOM(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const matches = node.nodeValue.match(URL_PATTERN);
            if (matches) {
                matches.forEach(url => {
                    if (url.includes(TARGET_HOST)) {
                        foundUrls.add(url.trim());
                    }
                });
            }
            return;
        }
        ['src', 'href', 'data-src', 'data-url'].forEach(attr => {
            const value = node.getAttribute && node.getAttribute(attr);
            if (value && value.match(URL_PATTERN) && value.includes(TARGET_HOST)) {
                foundUrls.add(value.trim());
            }
        });
        node.childNodes.forEach(scanDOM);
    }

    // 复制功能（无 GM_setClipboard）
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // 兼容旧浏览器
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            return true;
        } catch (e) {
            console.error('复制失败:', e);
            return false;
        }
    }

    // 创建按钮
    function createButton() {
        if (document.getElementById('m3u8-copy-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'm3u8-copy-btn';
        btn.textContent = '📋 Copy M3U8';

        // 恢复按钮位置
        const pos = JSON.parse(localStorage.getItem('m3u8-btn-pos') || '{}');
        const bottom = pos.bottom || 20;
        const right = pos.right || 20;

        btn.style.cssText = `
            position: fixed; bottom: ${bottom}px; right: ${right}px; z-index: 9999;
            background: #4CAF50; color: white; border: none;
            padding: 8px 12px; border-radius: 6px; cursor: pointer;
            font-size: 14px; box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            user-select: none; transition: background 0.3s;
        `;

        // 点击复制
        btn.onclick = async () => {
            if (foundUrls.size === 0) {
                btn.textContent = '⚠️ No links';
                btn.style.background = '#b71c1c';
                setTimeout(() => {
                    btn.textContent = '📋 Copy M3U8';
                    btn.style.background = '#4CAF50';
                }, 1500);
                return;
            }

            const urls = Array.from(foundUrls).map(url => url.replace(REMOVE_PREFIX, '')).join('\n');
            const ok = await copyToClipboard(urls);

            btn.textContent = ok ? '✅ Copied!' : '❌ Copy Failed';
            btn.style.background = ok ? '#2e7d32' : '#b71c1c';
            setTimeout(() => {
                btn.textContent = '📋 Copy M3U8';
                btn.style.background = '#4CAF50';
            }, 1500);
        };

        // 拖动功能
        let isDragging = false, startX, startY, startBottom, startRight;
        btn.addEventListener('mousedown', e => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startBottom = parseInt(btn.style.bottom);
            startRight = parseInt(btn.style.right);
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dY = e.clientY - startY;
            const dX = e.clientX - startX;
            const newBottom = Math.max(0, startBottom - dY);
            const newRight = Math.max(0, startRight - dX);
            btn.style.bottom = newBottom + 'px';
            btn.style.right = newRight + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
                localStorage.setItem('m3u8-btn-pos', JSON.stringify({
                    bottom: parseInt(btn.style.bottom),
                    right: parseInt(btn.style.right)
                }));
            }
        });

        document.body.appendChild(btn);
    }

    function main() {
        scanDOM(document.documentElement);
        if (foundUrls.size > 0) createButton();

        new MutationObserver(mutations => {
            let updated = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(scanDOM);
                if (mutation.addedNodes.length > 0) updated = true;
            });
            if (updated && foundUrls.size > 0) createButton();
        }).observe(document, { childList: true, subtree: true });
    }

    window.addEventListener('load', main, false);
})();
