/* Matching vocabulary only: independent of source recognition. */
(function(root){
 const data={categories:[
  {id:'cleaning',label:'清洁',keywords:['清洁','保洁','清潔','打扫','打掃'],related:['hotel_housekeeping']},
  {id:'hotel_housekeeping',label:'酒店客房',employerKeywords:['酒店','宾馆','賓館'],keywords:['客房','房务','房務','布草','酒店服务员','酒店服務員'],related:['cleaning']},
  {id:'kitchen_helper',label:'厨房帮工',keywords:['厨房帮工','廚房幫工','帮厨','幫廚','厨工','廚工','杂工（厨房）','切配','洗碗'],related:['cook']},
  {id:'cook',label:'厨师',keywords:['厨师','廚師','点心','點心','炒锅','炒鍋','砧板','中餐','西餐'],related:['kitchen_helper']},
  {id:'care',label:'护理',keywords:['护理','護理','看护','看護','照顾长者','照顧長者','护工','護工'],related:[]},
  {id:'warehouse',label:'仓储',keywords:['理货','理貨','仓库','倉庫','仓储','拣货','揀貨','搬运','搬運'],related:['packing']},
  {id:'packing',label:'包装',keywords:['包装','包裝','装箱','裝箱'],related:['warehouse']},
  {id:'office',label:'文职',keywords:['文员','文員','电脑操作','電腦操作','行政','资料录入','資料錄入'],related:[]},
  {id:'sales',label:'销售',keywords:['销售','銷售','售货','售貨','推销','推銷','零售'],related:[]},
  {id:'construction',label:'建筑地盘',keywords:['地盘','地盤','建筑','建築'],related:[]},
  {id:'driver',label:'司机',keywords:['司机','司機','驾驶','駕駛'],related:[]}
 ],dutyKeywords:['清点','清點','盘点','盤點','核对','核對','发票','發票','文件','接待','收银','收銀','采购','採購','维修','維修','电脑','電腦','照顾','照顧','服务顾客','服務顧客','陈列','陳列','操作机器','操作機器'],certificates:['护理证','護理證','护士证','護士證','厨师证','廚師證','健康证','健康證','电工证','電工證','焊工证','焊工證','驾驶证','駕駛證','叉车证','叉車證']};
 root.ZYJobCategories=data;if(typeof module!=='undefined'&&module.exports)module.exports=data;
})(globalThis);
