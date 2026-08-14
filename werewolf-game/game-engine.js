// ===== 隐藏狼人 - 游戏引擎 =====

class WerewolfGame {
  constructor() {
    this.state = null;
  }

  // 开始新游戏
  start() {
    const scene = SCENES[Math.floor(Math.random() * SCENES.length)];
    const werewolfIdx = Math.floor(Math.random() * scene.npcs.length);

    this.state = {
      scene: scene,
      turn: 1,
      timeOfDay: 'night',
      tension: 15,
      maxTurns: 15,
      npcs: scene.npcs.map((npc, i) => ({
        ...npc,
        isWerewolf: i === werewolfIdx,
        suspicion: 0,
        met: false,
        cluesRevealed: []
      })),
      cluesFound: [],
      usedClueIndices: [],
      usedRedHerringIndices: [],
      gameOver: false,
      result: null,
      history: []
    };

    // 标记第一个NPC为已遇到
    this.state.npcs[0].met = true;

    const opening = scene.opening + '\n\n---\n\n你看到了' + this.state.npcs[0].title + this.state.npcs[0].name + '。' + this.state.npcs[0].desc + '。\n\n（输入"帮助"查看你可以做什么）';

    return {
      text: opening,
      state: this.getPublicState()
    };
  }

  // 获取对玩家可见的状态（不包含狼人身份）
  getPublicState() {
    return {
      sceneName: this.state.scene.name,
      weather: this.state.scene.weather,
      turn: this.state.turn,
      maxTurns: this.state.maxTurns,
      timeOfDay: this.state.timeOfDay,
      tension: this.state.tension,
      npcs: this.state.npcs.map(n => ({
        name: n.name,
        title: n.title,
        desc: n.desc,
        suspicion: n.suspicion,
        met: n.met
      })),
      cluesFound: [...this.state.cluesFound],
      gameOver: this.state.gameOver,
      result: this.state.result
    };
  }

  // 解析玩家输入
  parseInput(input) {
    const text = input.trim();

    // 帮助
    if (/^(帮助|help|怎么玩|能做什么|指令)/i.test(text)) {
      return { type: 'help' };
    }

    // 指控狼人
    if (/(指认|指控|是狼人|就是狼|狼人是|凶手是|我怀疑|我觉得.*是狼)/i.test(text)) {
      for (const npc of this.state.npcs) {
        if (text.includes(npc.name)) {
          return { type: 'accuse', target: npc };
        }
      }
      return { type: 'accuse_no_target' };
    }

    // 交谈
    if (/(说话|交谈|聊天|问问|问问|对话|跟|和|找)/i.test(text)) {
      for (const npc of this.state.npcs) {
        if (text.includes(npc.name)) {
          return { type: 'talk', target: npc };
        }
      }
    }

    // 单独输入NPC名字 = 想和ta交谈
    for (const npc of this.state.npcs) {
      if (text === npc.name || text === npc.title + npc.name) {
        return { type: 'talk', target: npc };
      }
    }

    // 调查
    if (/(调查|检查|搜查|搜索|查看|观察|仔细看|看看|翻找|检查)/i.test(text)) {
      return { type: 'investigate' };
    }

    // 探索
    if (/(探索|走走|四处|周围|前面|到处|逛逛|看看周围|走|前进|离开|去)/i.test(text)) {
      return { type: 'explore' };
    }

    // 其他
    return { type: 'other', raw: text };
  }

  // 处理一回合
  processTurn(input) {
    if (this.state.gameOver) {
      return { text: '游戏已经结束。点击"重新开始"开始新游戏。', state: this.getPublicState() };
    }

    const intent = this.parseInput(input);

    // 指控和帮助永远允许，不消耗回合
    if (intent.type === 'accuse') {
      return this.handleAccusation(intent.target);
    }
    if (intent.type === 'accuse_no_target') {
      return {
        text: '你想要指认狼人，但你需要说清楚是谁。比如："我指认卡尔是狼人"。',
        state: this.getPublicState(),
        noTurnAdvance: true
      };
    }
    if (intent.type === 'help') {
      return { text: HELP_TEXT, state: this.getPublicState(), noTurnAdvance: true };
    }

    // 超过最大回合，狼人袭击
    if (this.state.turn >= this.state.maxTurns) {
      return this.handleWerewolfAttack();
    }

    let response = '';

    switch (intent.type) {
      case 'talk':
        response = this.handleTalk(intent.target);
        break;

      case 'investigate':
        response = this.handleInvestigate();
        break;

      case 'explore':
        response = this.handleExplore();
        break;

      default:
        response = this.handleOther(intent.raw);
    }

    // 推进回合
    this.advanceTurn();

    // 尝试植入线索
    if (this.state.turn >= 3 && !this.state.gameOver) {
      const clue = this.tryPlantClue();
      if (clue) {
        response += '\n\n---\n\n' + clue;
      }
    }

    // 随机氛围事件
    if (Math.random() < 0.25 && !this.state.gameOver) {
      const atmo = ATMOSPHERE_EVENTS[Math.floor(Math.random() * ATMOSPHERE_EVENTS.length)];
      response += '\n\n' + atmo;
    }

    // 检查是否到达极限
    if (this.state.tension >= 100 && !this.state.gameOver) {
      return this.handleWerewolfAttack();
    }

    return {
      text: response,
      state: this.getPublicState()
    };
  }

  // 推进回合
  advanceTurn() {
    this.state.turn++;

    // 切换昼夜
    if (this.state.turn % 3 === 0) {
      this.state.timeOfDay = this.state.timeOfDay === 'day' ? 'night' : 'day';
    }

    // 增加紧张度
    const tensionIncrease = 6 + Math.floor(Math.random() * 5) + Math.floor(this.state.turn / 3);
    this.state.tension = Math.min(100, this.state.tension + tensionIncrease);
  }

  // 处理交谈
  handleTalk(npc) {
    npc.met = true;

    const templates = DIALOGUE_TEMPLATES[npc.personality] || DIALOGUE_TEMPLATES.friendly;
    const template = templates[Math.floor(Math.random() * templates.length)];

    let dialogue = template
      .replace(/{npc}/g, npc.name)
      .replace(/{desc}/g, npc.desc);

    // 如果是狼人，在后期对话中加入微妙异常
    if (npc.isWerewolf && this.state.turn >= 5 && Math.random() < 0.4) {
      const wolfHints = [
        '\n\n说话间，你注意到' + npc.name + '的牙齿似乎比常人尖锐一些。',
        '\n\n' + npc.name + '的手指不经意间在桌面上留下了几道浅浅的抓痕。',
        '\n\n当' + npc.name + '转身时，你瞥见ta的影子似乎比正常人的要大一些。',
        '\n\n' + npc.name + '的话语中提到了"月光"和"狩猎"，虽然语调轻松，但你总觉得不太对劲。'
      ];
      dialogue += wolfHints[Math.floor(Math.random() * wolfHints.length)];
      npc.suspicion = Math.min(100, npc.suspicion + 5);
    }

    return dialogue;
  }

  // 处理调查
  handleInvestigate() {
    // 检查是否能发现线索
    const findChance = 0.4 + this.state.turn * 0.04;

    if (Math.random() < findChance) {
      // 发现一条线索
      const clue = this.generateClue();
      if (clue) {
        const template = INVESTIGATE_FOUND[Math.floor(Math.random() * INVESTIGATE_FOUND.length)];
        return template.replace('{clue}', clue.text) + '\n\n' + this.formatClueEntry(clue);
      }
    }

    const nothing = INVESTIGATE_NOTHING[Math.floor(Math.random() * INVESTIGATE_NOTHING.length)];
    return nothing;
  }

  // 处理探索
  handleExplore() {
    // 随机遇到一个未遇到的NPC
    const unmetNpcs = this.state.npcs.filter(n => !n.met);
    let encounter = '';

    if (unmetNpcs.length > 0 && Math.random() < 0.5) {
      const npc = unmetNpcs[Math.floor(Math.random() * unmetNpcs.length)];
      npc.met = true;
      encounter = '\n\n你遇到了' + npc.title + npc.name + '。' + npc.desc + '。';
    }

    const action = '四处查看';
    const weatherDesc = WEATHER_DESCS[this.state.scene.id] || '四周一片寂静';
    const template = EXPLORE_TEMPLATES[Math.floor(Math.random() * EXPLORE_TEMPLATES.length)];

    let result = template
      .replace(/{action}/g, action)
      .replace(/{weather_desc}/g, weatherDesc);

    if (encounter) {
      result += encounter;
    }

    return result;
  }

  // 处理其他输入
  handleOther(raw) {
    const weatherDesc = WEATHER_DESCS[this.state.scene.id] || '四周一片寂静';
    const template = UNKNOWN_INPUT_RESPONSES[Math.floor(Math.random() * UNKNOWN_INPUT_RESPONSES.length)];

    // 尝试提取玩家的动作
    let action = raw.length > 20 ? raw.substring(0, 20) + '...' : raw;

    return template
      .replace(/{action}/g, action)
      .replace(/{weather_desc}/g, weatherDesc);
  }

  // 生成线索
  generateClue() {
    // 70%概率是狼人线索，30%是误导线索
    if (Math.random() < 0.7) {
      return this.generateWerewolfClue();
    } else {
      return this.generateRedHerringClue();
    }
  }

  // 生成狼人线索
  generateWerewolfClue() {
    const werewolf = this.state.npcs.find(n => n.isWerewolf);
    if (!werewolf) return null;

    // 找未使用的线索
    let availableIndices = [];
    for (let i = 0; i < WEREWOLF_CLUES.length; i++) {
      if (!this.state.usedClueIndices.includes(i)) {
        availableIndices.push(i);
      }
    }

    if (availableIndices.length === 0) {
      // 所有线索都用完了，重置
      this.state.usedClueIndices = [];
      availableIndices = Array.from({ length: WEREWOLF_CLUES.length }, (_, i) => i);
    }

    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.state.usedClueIndices.push(idx);

    const clueText = WEREWOLF_CLUES[idx].replace(/{npc}/g, werewolf.name);

    const clue = {
      text: clueText,
      target: werewolf.name,
      isWerewolfClue: true,
      turn: this.state.turn
    };

    this.state.cluesFound.push(clue);
    werewolf.suspicion = Math.min(100, werewolf.suspicion + 15);

    return clue;
  }

  // 生成误导线索
  generateRedHerringClue() {
    // 选一个非狼人NPC
    const nonWerewolves = this.state.npcs.filter(n => !n.isWerewolf && n.met);
    if (nonWerewolves.length === 0) return this.generateWerewolfClue();

    const npc = nonWerewolves[Math.floor(Math.random() * nonWerewolves.length)];

    let availableIndices = [];
    for (let i = 0; i < RED_HERRING_CLUES.length; i++) {
      if (!this.state.usedRedHerringIndices.includes(i)) {
        availableIndices.push(i);
      }
    }

    if (availableIndices.length === 0) {
      this.state.usedRedHerringIndices = [];
      availableIndices = Array.from({ length: RED_HERRING_CLUES.length }, (_, i) => i);
    }

    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.state.usedRedHerringIndices.push(idx);

    const clueText = RED_HERRING_CLUES[idx].replace(/{npc}/g, npc.name);

    const clue = {
      text: clueText,
      target: npc.name,
      isWerewolfClue: false,
      turn: this.state.turn
    };

    this.state.cluesFound.push(clue);
    npc.suspicion = Math.min(100, npc.suspicion + 10);

    return clue;
  }

  // 尝试在叙事中植入线索
  tryPlantClue() {
    const chance = 0.3 + this.state.tension / 200 + this.state.turn / 30;

    if (Math.random() < chance) {
      const clue = this.generateClue();
      if (clue) {
        return clue.text + '\n\n' + this.formatClueEntry(clue);
      }
    }

    return null;
  }

  // 格式化线索条目
  formatClueEntry(clue) {
    return '【线索 #' + this.state.cluesFound.length + '】关于' + clue.target + '的发现。';
  }

  // 处理指控
  handleAccusation(npc) {
    this.state.gameOver = true;

    if (npc.isWerewolf) {
      this.state.result = 'win';
      const template = ACCUSATION_CORRECT[Math.floor(Math.random() * ACCUSATION_CORRECT.length)];
      const text = template.replace(/{npc}/g, npc.name);
      return {
        text: text,
        state: this.getPublicState()
      };
    } else {
      this.state.result = 'lose';
      const werewolf = this.state.npcs.find(n => n.isWerewolf);
      const template = ACCUSATION_WRONG[Math.floor(Math.random() * ACCUSATION_WRONG.length)];
      const text = template
        .replace(/{npc}/g, npc.name)
        .replace(/{werewolf}/g, werewolf.name);
      return {
        text: text,
        state: this.getPublicState()
      };
    }
  }

  // 处理狼人袭击（超时失败）
  handleWerewolfAttack() {
    this.state.gameOver = true;
    this.state.result = 'lose';

    const werewolf = this.state.npcs.find(n => n.isWerewolf);
    const template = WEREWOLF_ATTACK[Math.floor(Math.random() * WEREWOLF_ATTACK.length)];
    const text = template.replace(/{werewolf}/g, werewolf.name);

    return {
      text: text,
      state: this.getPublicState()
    };
  }

  // 获取狼人身份（游戏结束后使用）
  getWerewolfName() {
    const werewolf = this.state.npcs.find(n => n.isWerewolf);
    return werewolf ? werewolf.name : '未知';
  }
}
