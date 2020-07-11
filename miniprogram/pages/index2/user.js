export function getUserInfo() {
  wx.getSetting({
    success: res => {
      if (res.authSetting['scope.userInfo']) {
        // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
        wx.getUserInfo({
          success: res => {
            console.log(res)
            // this.setData({
            //   avatarUrl: res.userInfo.avatarUrl,
            //   userInfo: res.userInfo
            // })
          }
        })
      }
    }  
  })
  console.log('getUserInfo finish')
}
