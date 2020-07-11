// pages/index2/index.js
function arrayContains(a, e) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] == e) return true
  }
  return false
}

Page({

  /**
   * Page initial data
   */
  data: {
    avatarUrl: './user-unlogin.png',
    userInfo: {},
    logged: false,
    takeSession: false,
    requestResult: '',
    displayPlayers: [],
    teamA: [],
    teamB: [],
    picking: {
      id: -1
    },
    // selectingPlayer: {},
  },
  v: {
    playerIds: [2, 10, 11, 12, 13, 14, 16, 19, 20, 24, 25, 27, 30, 36, 87],
    playerMap: {},
    playerMapReady: false,
    exclusionSet: [],
    exclusionSetReady: false,
    picked: {},
    pickedReady: false,
    pickId: 'abc',
    myTeam: 'B',
    firstSelectTeam: 'A',
    teamA: [],
    teamB: [],
    pickLog: [],
    teamName: {
      'A': '蓝队',
      'B': '红队'
    },
    playerConflictMap: {},
    finished: false,
  },
  initData: function () {
    var me = this
    this.openWatcher()
    const db = wx.cloud.database()

    const _ = db.command
    this.data.displayPlayers = []

    db.collection('player').where({
      player_id: _.in(this.v.playerIds)
    }).get({
      success: res => {
        console.log(res.data)
        this.v.player_map = {}
        for (var i = 0; i < res.data.length; i++) {
          var d = res.data[i]
          // console.log(d)
          var p = {
            id: d.player_id,
            name: d.name,
            img: 'img/' + d.player_id + '.jpeg',
            description: d.description ? d.description : '他还没有留下简介',
          }
          this.v.player_map[d.player_id] = p
        }
        this.v.player_map_ready = true
        console.log('player ready')
        this.updateData()
      },
      fail: err => {
        wx.showToast({
          icon: 'none',
          title: '查询记录失败'
        })
        console.error('[数据库] [查询记录] 失败：', err)
      }
    })

    db.collection('exclusion').get({
      success: res => {
        // console.log('[数据库] [查询记录] 成功1: ', res)
        this.v.exclusion_set = []
        if (res.data.length > 0) {
          this.v.exclusion_set = res.data[0].set
        }
        this.v.exclusion_set_ready = true
        console.log('exclusion_set_ready')
        this.updateData()
      },
      fail: err => {
        wx.showToast({
          icon: 'none',
          title: '查询记录失败'
        })
        console.error('[数据库] [查询记录] 失败：', err)
      }
    })
    db.collection('pick_log').doc(this.v.pick_id).get({
      success: res => {
        // console.log('[数据库] [查询记录] 成功1: ', res)
        // for (var i = 0; i < res.data.length; i++) {
        //   var d = res.data[i]
        //   this.v.exclusion_set.push(d.set) 
        // }
        console.log(res.data)
        if (!res.data.log) {
          wx.showToast({
            icon: 'none',
            title: 'Fatal error: no log in pickLog, pick_id=' + me.v.pick_id
          })          
        }
        this.v.pickLog = res.data.log
        this.v.picked_ready = true
        console.log('pick_log_ready')
        this.updateData()
      },
      fail: err => {
        wx.showToast({
          icon: 'none',
          title: '查询记录失败'
        })
        console.error('[数据库] [查询记录] 失败：', err)
      }
    })
  },
  openWatcher: function () {
    const db = wx.cloud.database()
    var me = this
    this.watcher = db.collection('pick_log').doc(this.v.pick_id)
      .watch({
        onChange: function (snapshot) {
          //me.watcher.close()
          console.log('query result snapshot after the event', snapshot.docs)
          if (me.v.pickLog.length == snapshot.docs[0].log.length) {
            console.log('same data, skipped')
            return
          }
          me.v.pickLog = snapshot.docs[0].log
          me.updateData()
        },
        onError: function (err) {
          console.error('the watch closed because of error', err)
        }
      })
    // ...
    // 等到需要关闭监听的时候调用 close() 方法
    // this.watcher.close()
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function () {
    if (!wx.cloud) {
      wx.redirectTo({
        url: '../chooseLib/chooseLib',
      })
      return
    }

    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          wx.getUserInfo({
            success: res => {
              this.setData({
                avatarUrl: res.userInfo.avatarUrl,
                userInfo: res.userInfo
              })
            }
          })
        }
      }
    })
    this.v.pick_id = Math.floor(Math.random() * 100000)
    this.setupTestData()
    // this.initData()
  },
  setupTestData: async function () {
    const db = wx.cloud.database()
    db.collection('pick_log').doc(this.v.pick_id).set({
      data: {
        pick_id: this.v.pick_id,
        log : [{
          picker: 'A',
          pickee: 24,
          operation: 'initial',
        },
        {
          picker: 'B',
          pickee: 19,
          operation: 'initial',
        }],
      }
    }).then(res => {
      console.log('promoise: finish write data')
      console.log(res)
      this.initData()
    })
  },
  updateData: function () {
    console.log('trying:', this.v.exclusion_set_ready, this.v.player_map_ready, this.v.picked_ready)
    if (!this.v.exclusion_set_ready || !this.v.player_map_ready || !this.v.picked_ready) return
    console.log('setting')

    this.v.picked = {}
    this.v.groupA = []
    this.v.groupB = []
    for (var i = 0; i < this.v.pickLog.length; i++) {
      var p = this.v.pickLog[i]
      if (p.operation == 'giveup') {
        this.v.finished = true
        continue
      }
      this.v.picked[p.pickee] = p.picker
      if (p.picker == 'A') this.v.groupA.push(p.pickee)
      if (p.picker == 'B') this.v.groupB.push(p.pickee)
    }

    var remaining = {}
    // console.log(this.v.player_map)
    this.data.displayPlayers = []
    for (var k in this.v.player_map) {
      // console.log(k)
      remaining[k] = true
    }
    // console.log(remaining)
    for (var i = 0; i < this.v.exclusion_set.length; i++) {
      var s = this.v.exclusion_set[i]
      var g = []
      for (var j = 0; j < s.length; j++) {
        if (s[j] in remaining) {
          // console.log(s[j])
          delete remaining[s[j]]
          // var p = {}
          // Object.assign(p, this.v.player_map[s[j]])
          p = this.v.player_map[s[j]]
          p.picked = this.v.picked[s[j]]
          // console.log(p)
          g.push(p)
        }
      }
      if (g.length > 0) {
        this.data.displayPlayers.push({
          id: this.data.displayPlayers.length,
          players: g,
          style: g.length == 1 ? 'group_1_person' : 'group_2_people',
        })
        // console.log(this.data.displayPlayers)
      }
    }
    // console.log(remaining)
    for (var k in remaining) {
      // console.log(k)
      var p = this.v.player_map[k]
      p.picked = this.v.picked[k]
      this.data.displayPlayers.push({
        id: this.data.displayPlayers.length,
        players: [p],
        style: 'group_1_person',
      })
    }
    this.data.teamA = []
    this.data.teamB = []
    console.log(this.v.groupA)
    for (var i = 0; i < this.v.groupA.length; i++) {
      var id = this.v.groupA[i]
      var p = this.v.player_map[id]
      this.data.teamA.push(p)
      // console.log(id)
    }
    for (var i = 0; i < this.v.groupB.length; i++) {
      var id = this.v.groupB[i]
      var p = this.v.player_map[id]
      this.data.teamB.push(p)
      // console.log(id)
    }
    console.log(this.data.teamA)

    // Update playerConflictMap
    this.v.playerConflictMap = {}
    console.log(this.v.exclusion_set)
    for (var i = 0; i < this.v.exclusion_set.length; i++) {
      var s = this.v.exclusion_set[i]
      for (var j = 0; j < s.length; j++) {
        var a = s[j]
        if (!(a in this.v.player_map)) continue
        if (!(a in this.v.playerConflictMap)) {
          this.v.playerConflictMap[a] = {}
        }
        for (var k = 0; k < s.length; k++) {
          if (j == k) continue
          if (!(s[k] in this.v.player_map)) continue
          this.v.playerConflictMap[a][s[k]] = true
        }
      }
    }
    console.log("conflictmap: ", this.v.playerConflictMap)

    this.updatePicking()
    this.setData({
      displayPlayers: this.data.displayPlayers,
      teamA: this.data.teamA,
      teamB: this.data.teamB,
      picking: this.data.picking,
    })

    if (this.v.finished) {
      console.log("finishedd and return")
      return
    }

    var turn = this.getTurn()
    if (turn != this.v.myTeam) {
        this.simulateAIPick()
        // this.openWatcher()
    } else {
      var candidates = this.getRemainCandidates(this.v.myTeam)
      if (candidates.length == 0) {
        this.appendLog({
          picker: this.v.myTeam,
          pickee: 0,
          operation: 'giveup',           
        }, true)
        console.log('Automatically add giveup for ending')
        this.updateData()
      }
    }
  },

  onPick: function (event) {
    console.log('onPick')
    var id = parseInt(event.currentTarget.id)
    console.log(id)
    this.data.picking = this.v.player_map[id]
    console.log(this.data.picking)
    this.updatePicking()
    this.setData({
      picking: this.data.picking,
    })
  },
  updatePicking: function () {
    var turn = this.getTurn()
    console.log(turn)
    this.data.picking.canSelect = turn == this.v.myTeam && this.canPick(this.data.picking.id, this.v.myTeam)
    if (this.v.finished) {
      this.data.picking.message = '选择完毕'
      this.data.picking.color = 'green'      
    } else {
      this.data.picking.message = (turn == this.v.myTeam ? '请您选择：' : '等待对方选择:' ) + this.v.teamName[turn] 
      this.data.picking.color = turn == 'A' ? 'blue' : 'red'
    }
    console.log('updatePicking:', this.data.picking)
  },
  appendLog: function(record, updateLocal) {
    var log = []
    if (updateLocal) {
      log = this.v.pickLog
    } else {
      for (var i = 0; i < this.v.pickLog.length; i++) {
        log.push(this.v.pickLog[i])
      }      
    }
    log.push(record)
    const db = wx.cloud.database()
    db.collection('pick_log').doc(this.v.pick_id).update({
      data: {
        pick_id : this.v.pick_id,
        log : log,
      }
    }).then(res => {
      console.log('finish update db')
    })
  },
  onConfirm: function (event) {
    console.log('onConfirm')
    this.appendLog({
      picker: this.v.myTeam,
      pickee: this.data.picking.id,
      operation: 'manual',     
    }, true)
    this.updateData()
  },
  getImage: function (id) {
    return 'img/' + id + '.jpeg'
  },
  oppositeTeam: function (team) {
    if (team == 'A') return 'B'
    if (team == 'B') return 'A'
    return ''
  },
  getTurn: function () {
    console.log(this.v.pickLog)
    var last = ''
    for (var i = this.v.pickLog.length - 1; i >= 0; i--) {
      var r = this.v.pickLog[i]
      console.log(r)
      switch (r.operation) {
        case 'initial':
          if (last == '') {
            return this.v.firstSelectTeam
          } else {
            return this.oppositeTeam(last)
          }
          break
        case 'manual':
          if (last == '') {
            last = r.picker
          } else if (last == r.picker) {
            return this.oppositeTeam(last)
          } else {
            return last
          }
          break
        case 'giveup':
          return this.oppositeTeam(r.picker)
      }
    }
    return this.v.firstSelectTeam
  },
  canPickSingleton: function(id, team) {
    // rule: can only select half of singletons
    var isSingleton = false
    var num_all = 0, num_singleton_all = 0, num_singleton_selected = 0
    for (var k in this.v.player_map) {
      num_all++
      if (!(k in this.v.playerConflictMap) || Object.keys(this.v.playerConflictMap[k]).length == 0) {
        num_singleton_all++
        if (id == k) isSingleton = true
        if ((team == 'A' && arrayContains(this.v.groupA, k)) || 
        (team == 'B' && arrayContains(this.v.groupB, k))) {
          num_singleton_selected++
        }        
      }        
    }
    if (!isSingleton) return false
    var delta = 0
    if (num_all % 2 == 1) {
      // should substract 2 preselected
      var firstPickNeedMore = num_all % 4 == 3
      var isMeFirst = team == this.v.firstSelectTeam
      if (!firstPickNeedMore ^ isMeFirst) {
        delta = 1
      }    
    }
    console.log(id, team, num_all, num_singleton_all, num_singleton_selected, delta)
    if (num_singleton_selected >= (num_singleton_all + delta) / 2) {
      console.log('choose over half of singleton')
      return true
    }
    return false
  },
  canPick: function (id, team) {
    if (id in this.v.picked) return false
    for (var k in this.v.playerConflictMap[id]) {
      if (k in this.v.picked && this.v.picked[k] == team) return false
    }
    if (id > 0 && this.canPickSingleton(id, team)) {
      return false
    }
    return true
  },
  getRemainCandidates : function(team) {
    var candidates = []
    for (var p in this.v.player_map) {
      if (this.canPick(p, team)) candidates.push(p)
    }
    return candidates
  },
  simulateAIPick: function () {
    var team = this.oppositeTeam(this.v.myTeam)
    var candidates = this.getRemainCandidates(team)
    var id = 0
    var operation = 'giveup'
    if (candidates.length > 0) {
      var index = Math.floor(Math.random() * candidates.length)
      id = candidates[index]
      operation = 'manual'
    }
    var f = this.appendLog
    console.log('AI will pick ', id, ' in 3 seconds')
    setTimeout(function () {
      f({
        picker: team,
        pickee: parseInt(id),
        operation: operation,     
      }, false)
    }, 3000)
  },
  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})