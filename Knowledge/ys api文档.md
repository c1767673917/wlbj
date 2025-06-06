1. 请求说明
   请求域名	动态域名，获取方式详见 获取租户所在数据中心域名
   请求地址	https://c4.yonyoucloud.com/iuap-api-gateway/yonbip/scm/salesout/list
   请求方式	POST
   ContentType	application/json
   应用场景	开放API
   API类别
   事务和幂等性	无
   限流次数
   60次/分钟
   购买API加速包，升级至120次/分钟
   立即购买
   用户身份	支持传递普通用户身份，详细说明见开放平台用户认证接入规范
   多语	不支持
2. 请求参数
   只看必填项
   名称	类型	参数位置	必填	描述
   access_token	string	query	是	调用方应用token
   企业自建获取token
   Body参数
   名称	类型	数组	必填	描述
   isdefault	string	否	否	该参数可忽略不管
   pageIndex	int	否	是	页号    默认值: 1
   code	string	否	否	单据编号
   pageSize	int	否	是	每页行数    默认值: 10
   vouchdate	string	否	否	单据日期 区间格式，2021-05-06|2021-05-06 23:00:00。若传入单个时间如：2021-05-06，则查询该时间之后，到当前时间之间的单据
   stockOrg	object	否	否	库存组织id
   salesOrg	object	否	否	销售组织id
   invoiceOrg	object	否	否	开票组织ID
   invoiceCust	object	否	否	开票客户id
   upcode	string	否	否	来源单据号
   department	object	否	否	部门id
   operator	object	否	否	业务员id
   warehouse	object	否	否	仓库id
   stockMgr	object	否	否	库管员id
   cust	object	否	否	客户id
   product_cName	string	否	否	物料id
   bustype.name	object	否	否	交易类型名称
   product_cName_ManageClass	object	否	否	物料分类id
   isSum	boolean	否	否	查询表头    示例: false    默认值: false
   simpleVOs	object	是	否	扩展查询条件
   op	string	否	否	比较符(条件eq:相等, neq：不等, lt：小于, gt：大于, elt：小于等于, egt：大于等于, between：区间, in：包含, nin：不包含, like：包含字符, leftlike：左侧字符包含, rightlike：右侧字符包含, is_null：为空, is_not_null：不为空, and：和, or：或 )
   value2	string	否	否	值2(条件)如："2021-04-19 23:59:59"
   value1	string	否	否	值1(条件)如： "2021-04-19 00:00:00"
   field	string	否	否	属性名(条件传属性的名称，如仓库编码warehouse.code、时间戳pubts、物料编码details.product.cCode、表头自定义项headItem.define1、表体自定义项details.bodyItem.define1等)
3. 请求示例
   Url: /yonbip/scm/salesout/list?access_token=访问令牌
   Body: {
   "isdefault": "",
   "pageIndex": 0,
   "code": "",
   "pageSize": 0,
   "vouchdate": "",
   "stockOrg": {},
   "salesOrg": {},
   "invoiceOrg": {},
   "invoiceCust": {},
   "upcode": "",
   "department": {},
   "operator": {},
   "warehouse": {},
   "stockMgr": {},
   "cust": {},
   "product_cName": "",
   "bustype.name": {},
   "product_cName_ManageClass": {},
   "isSum": false,
   "simpleVOs": [
   {
   "op": "",
   "value2": "",
   "value1": "",
   "field": ""
   }
   ]
   }
4. 返回值参数
   名称	类型	数组	描述
   code	string	否	返回码，调用成功时返回200
   message	string	否	调用失败时的错误信息
   data	object	否	调用成功时的返回数据
   pageIndex	long	否	当前页
   pageSize	long	否	分页大小
   recordCount	long	否	总记录数
   recordList	object	是	返回数据列表
   sumRecordList	object	是	合计信息
   pageCount	long	否	总页数
   beginPageIndex	long	否	开始页页号
   endPageIndex	long	否	最终页页号
   pubts	string	否	时间戳
5. 正确返回示例
   {
   "code": "200",
   "message": "操作成功",
   "data": {
   "pageIndex": 1,
   "pageSize": 10,
   "recordCount": 26,
   "recordList": [
   {
   "cReceiveAddress": "1111",
   "oriTax": 0.19,
   "details_stockUnitId": 1870647175155968,
   "product_cCode": "hy母件002",
   "details_taxId": "8b99f589-bc47-4c8a-bfqw-13d78caa20b0",
   "natCurrency": "G001ZM0000DEFAULTCURRENCT00000000001",
   "sourcesys": "udinghuo",
   "tradeRouteID": 0,
   "stockUnitId_Precision": 2,
   "id": 2283114439348480,
   "status_mobile_row": 0,
   "invoiceTitle": "123抬头",
   "details_priceUOM": 1870647175155968,
   "natSum": 4,
   "isEndTrade": 0,
   "warehouse": 1825292664836352,
   "srcBillType": "1",
   "diliverStatus": "DELIVERING",
   "warehouse_name": "调入仓库B",
   "natCurrency_priceDigit": 3,
   "exchRateType": "sfaju9kr",
   "tradeRouteLineno": "",
   "invExchRate": 1,
   "product_defaultAlbumId": "",
   "status": 0,
   "currency_moneyDigit": 2,
   "invoiceCust_name": "张三啊",
   "details_productsku": 2154196234342656,
   "salesOrg": "2144094855762432",
   "invoiceOrg_name": "hy组织001",
   "tradeRoute_name": "",
   "productsku_cName": "hy母件002",
   "vouchdate": "2021-06-01 00:00:00",
   "invPriceExchRate": 1,
   "currency": "G001ZM0000DEFAULTCURRENCT00000000001",
   "pubts": "2021-06-02 15:10:23",
   "org_name": "hy组织001",
   "cReceiveMobile": "4353",
   "createDate": "2021-06-01 00:00:00",
   "creator": "rtduanhy",
   "oriSum": 4,
   "exchRateType_name": "基准汇率",
   "accountOrg": "2144094855762432",
   "stsalesOutExchangeInfo_d_key": 2283114439348480,
   "cReceiver": "43543",
   "details_id": 2283114439364864,
   "priceQty": 2,
   "createTime": "2021-06-01 20:24:08",
   "taxUnitPriceTag": true,
   "details_product": 2154196222431488,
   "taxNum": "1245345524",
   "department_name": "XX部门",
   "operator_name": "某某",
   "invoiceAddress": "某地区街道",
   "operator": 23432453453,
   "bankAccount": "53434534534",
   "subBankName": "某某支行",
   "bankName": "某银行",
   "invoiceTelephone": "123123123",
   "department": "454674756",
   "cust": 1822523165643008,
   "invoiceUpcType": "0",
   "natMoney": 3.81,
   "currency_priceDigit": 3,
   "invoiceOrg": "2144094855762432",
   "stockUnit_name": "件",
   "collaborationPolineno": "",
   "bustype_name": "销售出库",
   "modifier": "rtduanhy",
   "firstupcode": "UO-test20210601000012",
   "source": "1",
   "natTax": 0.19,
   "subQty": 2,
   "taxItems": "5%",
   "modifyTime": "2021-06-02 15:10:23",
   "product_cName": "hy母件002",
   "invoiceTitleType": "0",
   "receiveContacterPhone": "13261196070",
   "modifyInvoiceType": "1",
   "natCurrencyName": "人民币",
   "salesOrg_name": "hy组织001",
   "modifyDate": "2021-06-02 00:00:00",
   "unitName": "件",
   "contactName": "张三",
   "srcBillNO": "TI2432210601000012",
   "oriUnitPrice": 1.905,
   "taxCode": "VAT5",
   "barCode": "st_salesout|2283114439348480",
   "unit_name": 1870647175155968,
   "taxRate": 5,
   "unit": "件",
   "productsku_cCode": "hy母件002",
   "natCurrency_moneyDigit": 2,
   "accountOrg_name": "hy组织001",
   "taxId": "VAT5",
   "invoiceCust": 1822523165643008,
   "qty": 2,
   "unit_Precision": 2,
   "oriTaxUnitPrice": 2,
   "oriMoney": 3.81,
   "contactsPieces": 2,
   "contactsQuantity": 2,
   "natUnitPrice": 1.905,
   "code": "XSCK20210601000001",
   "receiveAccountingBasis": "voucher_delivery",
   "logistics": "XSCK20210601000001",
   "exchRate": 1,
   "currencyName": "人民币",
   "cust_name": "张三啊",
   "org": "2144094855762432",
   "priceUOM_name": "件",
   "bustype": "110000000000028",
   "receiveId": 1822523165643009,
   "upcode": "TI2432210601000012",
   "saleStyle": "SALE",
   "iLogisticId": 0,
   "status_mobile": 0,
   "natTaxUnitPrice": 2,
   "salesOutDefineCharacter": {},
   "salesOutsDefineCharacter": {},
   "salesOutsCharacteristics": {},
   "out_sys_id": "",
   "out_sys_code": "",
   "out_sys_version": "",
   "out_sys_type": "",
   "out_sys_rowno": "",
   "out_sys_lineid": "",
   "collaborationPocode": "",
   "collaborationPoid": 0,
   "collaborationPodetailid": 0,
   "collaborationSource": "",
   "salesOutsExtend!coUpcode": "",
   "salesOutsExtend!coSourceid": 0,
   "salesOutsExtend!coSourceLineNo": "",
   "salesOutsExtend!coSourceType": ""
   }
   ],
   "sumRecordList": [
   {
   "totalPieces": 2,
   "oriSum": 51222,
   "invoiceOriSum": 27922,
   "saleReturnQty": 34,
   "natSum": 51222,
   "subQty": 492,
   "totalQuantity": 2,
   "priceQty": 492,
   "qty": 492,
   "oriMoney": 49705.27,
   "invoiceQty": 298,
   "contactsPieces": 481,
   "contactsQuantity": 481,
   "natMoney": 49705.27
   }
   ],
   "pageCount": 3,
   "beginPageIndex": 1,
   "endPageIndex": 3,
   "pubts": "2021-06-02 16:37:29"
   }
   }
6. 错误返回码
   错误码	错误信息	描述
   999	列表查询失败	检查查询条件和单据编码是否正确
7. 错误返回示例
   {"code":999,"message":"列表查询失败"}
