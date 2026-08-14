// ===== UI 控制层 =====

const App = {
  game: null,
  chatArea: null,
  inputField: null,
  sendBtn: null,
  restartBtn: null,
  isProcessing: false,

  init() {
    this.chatArea = document.getElementById('chat-area');
    this.inputField = document.getElementById('input-field');
    this.sendBtn = document.getElementById('send-btn');
    this.restartBtn = document.getElementById('restart-btn');

    // 事件绑定
    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.restartBtn.addEventListener('click', () => this.handleRestart());

    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // 自动调整输入框高度
    this.inputField.addEventListener('input', () => {
      this.inputField.style.height = 'auto';
      this.inputField.style.height = Math.min(this.inputField.scrollHeight, 120) + 'px';
    });

    // 快捷按钮
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.inputField.value = btn.dataset.action;
        this.handleSend();
      });
    });

    // 开始游戏
    this.startGame();
  },

  // 开始新游戏
  startGame() {
    this.game = new WerewolfGame();
    const result = this.game.start();

    // 清空聊天区
    this.chatArea.innerHTML = '';

    // 显示开场白
    this.addMessage('narrator', result.text, '叙事');

    // 更新侧边栏
    this.updateSidebar(result.state);

    // 启用输入
    this.setInputEnabled(true);
    this.inputField.focus();
  },

  // 处理发送
  async handleSend() {
    if (this.isProcessing) return;

    const input = this.inputField.value.trim();
    if (!input) return;

    // 显示玩家输入
    this.addMessage('player', input);

    // 清空输入框
    this.inputField.value = '';
    this.inputField.style.height = 'auto';

    // 禁用输入
    this.isProcessing = true;
    this.setInputEnabled(false);

    // 显示"思考中"
    const thinkingEl = this.addMessage('system', '叙事引擎编织故事中...');

    // 模拟延迟（增加沉浸感）
    await this.delay(600 + Math.random() * 600);

    // 处理回合
    const result = this.game.processTurn(input);

    // 移除"思考中"
    thinkingEl.remove();

    // 显示回复
    if (result.state.gameOver) {
      this.addMessage('game-over', result.text, null, result.state.result);
    } else {
      this.addMessage('narrator', result.text, '叙事');
    }

    // 更新侧边栏
    this.updateSidebar(result.state);

    // 恢复输入
    this.isProcessing = false;
    if (!result.state.gameOver) {
      this.setInputEnabled(true);
      this.inputField.focus();
    }
  },

  // 重新开始
  handleRestart() {
    this.startGame();
  },

  // 添加消息
  addMessage(type, text, speaker, result) {
    const msg = document.createElement('div');
    msg.className = 'message ' + type;

    if (type === 'game-over') {
      const isWin = result === 'win';
      msg.innerHTML = `
        <div class="result-badge ${isWin ? 'win' : 'lose'}">${isWin ? '胜利' : '失败'}</div>
        <div class="narrative">${this.escapeHtml(text)}</div>
        <div style="margin-top:20px;font-size:13px;color:var(--text-muted);">
          点击"重新开始"再来一局
        </div>
      `;
    } else if (type === 'player') {
      msg.innerHTML = `<div class="bubble">${this.escapeHtml(text)}</div>`;
    } else if (type === 'system') {
      msg.innerHTML = `<div class="bubble">${this.escapeHtml(text)}</div>`;
    } else {
      // narrator
      let html = '';
      if (speaker) {
        html += `<div class="speaker">${this.escapeHtml(speaker)}</div>`;
      }
      html += `<div class="narrative-text">${this.escapeHtml(text)}</div>`;
      msg.innerHTML = html;
    }

    this.chatArea.appendChild(msg);
    this.scrollToBottom();

    return msg;
  },

  // 更新侧边栏
  updateSidebar(state) {
    // 场景信息
    document.getElementById('scene-name').textContent = state.sceneName;
    document.getElementById('scene-weather').textContent = state.weather;

    // 回合
    document.getElementById('turn-count').textContent = state.turn + ' / ' + state.maxTurns;

    // 时间
    const timeText = state.timeOfDay === 'day' ? '白天' : '夜晚';
    const timeEl = document.getElementById('time-of-day');
    timeEl.textContent = timeText;
    timeEl.style.color = state.timeOfDay === 'night' ? 'var(--accent)' : 'var(--text-primary)';

    // 紧张度
    const tensionPercent = Math.round(state.tension);
    document.getElementById('tension-value').textContent = tensionPercent + '%';
    const tensionFill = document.getElementById('tension-fill');
    tensionFill.style.width = tensionPercent + '%';

    // 紧张度颜色变化
    if (tensionPercent >= 80) {
      tensionFill.style.backgroundPosition = 'right';
    } else if (tensionPercent >= 50) {
      tensionFill.style.backgroundPosition = 'center';
    } else {
      tensionFill.style.backgroundPosition = 'left';
    }

    // NPC列表
    const npcList = document.getElementById('npc-list');
    npcList.innerHTML = '';
    state.npcs.forEach(npc => {
      const card = document.createElement('div');
      card.className = 'npc-card' + (npc.met ? '' : ' unmet');

      const suspicionPercent = Math.round(npc.suspicion);
      let suspicionColor = 'var(--text-muted)';
      if (suspicionPercent > 60) suspicionColor = 'var(--danger)';
      else if (suspicionPercent > 30) suspicionColor = 'var(--accent)';

      card.innerHTML = `
        <div class="npc-name">${this.escapeHtml(npc.name)}</div>
        <div class="npc-title">${this.escapeHtml(npc.title)}</div>
        ${npc.met ? `<div class="npc-desc">${this.escapeHtml(npc.desc)}</div>` : ''}
        ${npc.met ? `
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="suspicion-bar" style="flex:1;">
              <div class="suspicion-fill" style="width:${suspicionPercent}%;background:${suspicionColor};"></div>
            </div>
            <span style="font-size:10px;color:${suspicionColor};min-width:28px;text-align:right;">${suspicionPercent}%</span>
          </div>
        ` : ''}
      `;

      // 点击NPC = 和ta交谈
      if (npc.met && !state.gameOver) {
        card.addEventListener('click', () => {
          this.inputField.value = '和' + npc.name + '说话';
          this.handleSend();
        });
      }

      npcList.appendChild(card);
    });

    // 线索列表
    const clueList = document.getElementById('clue-list');
    if (state.cluesFound.length === 0) {
      clueList.innerHTML = '<div class="no-clues">尚未发现线索</div>';
    } else {
      clueList.innerHTML = '';
      state.cluesFound.forEach((clue, idx) => {
        const item = document.createElement('div');
        item.className = 'clue-item';
        item.innerHTML = `
          <div class="clue-target">关于 ${this.escapeHtml(clue.target)} · 回合${clue.turn}</div>
          ${this.escapeHtml(clue.text)}
        `;
        clueList.appendChild(item);
      });
    }
  },

  // 启用/禁用输入
  setInputEnabled(enabled) {
    this.inputField.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
  },

  // 滚动到底部
  scrollToBottom() {
    this.chatArea.scrollTop = this.chatArea.scrollHeight;
  },

  // 延迟
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }
};

// 启动
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
