// pages/index/index.js
// 保险查勘助手 - 车祸现场AI识别

Page({
  // ========== 数据定义 ==========
  data: {
    imagePath: '',      // 用户选择的图片路径（临时路径）
    result: '',         // 检测结果文字，如"检测到车祸现场"
    confidence: 0,       // 置信度百分比，如 92.5
    boxes: [],           // 检测框坐标数组
    loading: false,      // 是否正在推理中（控制按钮状态）
    modelLoaded: false   // 模型是否已加载（预留，端侧推理时用）
  },

  // ========== 页面加载时执行 ==========
  onLoad() {
    console.log('【保险查勘助手】页面加载');
    // 目前使用云端推理，标记模型为已就绪
    this.setData({ modelLoaded: true });
  },

  // ========== 用户点击拍照/选图 ==========
  takePhoto() {
    const that = this;  // 保存this引用，因为success回调里this会改变
    
    // 调用微信API：选择图片（支持相机和相册）
    wx.chooseMedia({
      count: 1,                    // 只选1张
      mediaType: ['image'],         // 只选图片
      sourceType: ['album', 'camera'],  // 支持相册和相机两种来源
      
      // 选择成功后的回调
      success(res) {
        // res.tempFiles[0].tempFilePath 是微信生成的临时文件路径
        const tempPath = res.tempFiles[0].tempFilePath;
        console.log('✅ 选择图片成功:', tempPath);
        
        // 更新页面数据：显示图片 + 显示"分析中"
        that.setData({
          imagePath: tempPath,
          result: '正在分析...',
          confidence: 0,
          boxes: [],
          loading: true
        });

        // 调用推理函数
        that.runInference(tempPath);
      },
      
      // 选择失败（用户取消等）
      fail(err) {
        console.error('❌ 选择图片失败:', err);
        wx.showToast({ 
          title: '选择图片失败', 
          icon: 'none'  // none表示不显示图标，纯文字
        });
      }
    });
  },

  // ========== 核心：执行推理 ==========
  runInference(imagePath) {
    const that = this;
    
    // 显示微信加载提示（转圈圈）
    wx.showLoading({ 
      title: 'AI分析中...',
      mask: true  // 遮罩层，防止用户点击其他区域
    });

    // 使用 wx.uploadFile 上传图片到服务器
    // 注意：localhost:5000 只在电脑调试时可用
    // 真机调试时需要换成服务器的公网IP或域名
    wx.uploadFile({
      url: 'https://detection-labrador-flagman.ngrok-free.dev/detect',  // 后端接口地址
      filePath: imagePath,                    // 要上传的图片路径
      name: 'image',                          // 后端通过这个名字获取文件
      
      // 上传成功后的回调
      success(res) {
        wx.hideLoading();  // 隐藏加载提示
        
        console.log('服务器返回:', res.data);
        
        // res.data 是字符串，需要解析为JSON
        // 解析服务器返回的数据
const data = JSON.parse(res.data);
console.log('服务器返回:', data);

// +++ 1. 先获取图片在屏幕上的真实大小 +++
wx.createSelectorQuery().select('.preview-img').boundingClientRect().exec((rectRes) => {
    if (rectRes[0]) {
        const rect = rectRes[0];
        // --- 2. 调用画框函数，把数据和图片尺寸传给它 ---
        that.drawBoxes(data.boxes || [], rect.width, rect.height);
    }
});

// 更新页面数据
that.setData({
    result: data.isAccident ? '⚠️ 检测到车祸现场' : '✅ 未检测到车祸',
    confidence: (data.confidence * 100).toFixed(1),
    boxes: data.boxes || [],
    loading: false
});

        // 高置信度时弹出提示框
        if (data.confidence > 0.9) {
          wx.showModal({
            title: '高置信度预警',
            content: 'AI检测到高度疑似车祸现场，建议立即拍照留存证据并联系保险公司。',
            showCancel: false,  // 不显示取消按钮，只有确定
            confirmText: '知道了'
          });
        }
      },
      
      // 上传失败（网络错误等）
      fail(err) {
        wx.hideLoading();
        console.error('❌ 推理请求失败:', err);
        
        that.setData({ 
          result: '网络错误，请检查连接后重试', 
          loading: false 
        });
        
        wx.showToast({ 
          title: '网络错误', 
          icon: 'none' 
        });
      }
    });
  },

  // ========== 查看历史记录（预留功能）==========
  viewHistory() {
    wx.showToast({
      title: '历史功能开发中',
      icon: 'none'
    });
  }
});