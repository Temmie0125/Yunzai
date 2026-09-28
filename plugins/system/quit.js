import cfg from "../../lib/config/config.js"

export class quit extends plugin {
  constructor() {
    super({
      name: "Autoquit",
      dsc: "自动退群",
      event: "notice.group.increase",
    })
  }

  async accept() {
    // 仅处理机器人自己被拉入群的事件
    logger.info(`群成员增加：${this.e.user_id} => ${this.e.group_id}, type: ${this.e.sub_type}`);
    if (this.e.user_id != this.e.self_id || !this.e.group?.quit || !this.e.group.getMemberMap) return false
    
    const other = cfg.other
    // 如果 autoQuit 未配置（不是数字），则不处理
    if (typeof other.autoQuit !== 'number') return false

    const gml = await this.e.group.getMemberMap()
    if (!(gml instanceof Map)) return false

    // 获取操作者QQ（拉群的人）
    const operatorId = this.e.operator_id
    if (!operatorId) {
      // 如果没有操作者信息，按原逻辑处理（保留原主人群成员判断作为兜底）
      // 但一般不会出现，可考虑直接退群或忽略
      /** 判断主人邀请不退群 */
      for (const qq of cfg.masterQQ) {
        if (gml.has(Number(qq) || String(qq))) {
          logger.mark(`[主人拉群] ${this.e.group_id}`)
          return false
        }
      }
      logger.warn(`[自动退群] 未获取到操作者信息，群: ${this.e.group_id}`)
    } else {
      // 判断操作者是否为主人或白名单用户
      const masterQQ = other.masterQQ || []
      const whiteUser = other.whiteUser || []
      const opNum = Number(operatorId)
      const opStr = String(operatorId)
      const isMaster = masterQQ.some(qq => qq == opNum || qq == opStr)
      const isWhite = whiteUser.some(qq => qq == opNum || qq == opStr)
      if (isMaster || isWhite) {
        logger.mark(`[授权拉群] 操作者: ${operatorId} 为${isMaster ? '主人' : '白名单用户'}, 不退群`)
        return false
      }
    }

    // autoQuit === 0 表示启用“直接拉入自动退群”（不检查成员数）
    if (other.autoQuit === 0) {
      if (!this.e.group.is_owner) {
        await this.reply("请不要未经同意就拉光光入群！告辞！")
        // 等待1秒再退群，更符合真人操作
        await new Promise(resolve => setTimeout(resolve, 1000))
        logger.mark(`[自动退群-直接拉入] ${this.e.group_id}`)
        this.e.group.quit()
      }
      return false
    }

    /** 自动退群（基于成员数阈值） */
    if (Array.from(gml).length <= other.autoQuit && !this.e.group.is_owner) {
      await this.reply("请不要未经同意就拉光光入群！告辞！")
      // 等待1秒再退群，更符合真人操作
      await new Promise(resolve => setTimeout(resolve, 1000))
      logger.mark(`[自动退群] ${this.e.group_id}`)
      this.e.group.quit()
    }
  }
}