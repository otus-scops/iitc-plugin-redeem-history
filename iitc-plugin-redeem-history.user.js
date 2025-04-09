// ==UserScript==
// @id             iitc-plugin-redeem-history@otusscops
// @name           IITC Plugin: Redeem History
// @category       Information
// @version        0.1.0.20250409.1100
// @author         otusscops
// @namespace      iitc-plugin-redeem-history
// @description    Record redeem history
// @downloadURL    https://github.com/otus-scops/iitc-plugin-redeem-history/raw/master/src/iitc-plugin-redeem-history.user.js
// @updateURL      https://github.com/otus-scops/iitc-plugin-redeem-history/raw/master/src/iitc-plugin-redeem-history.user.js
// @include        https://*.ingress.com/*
// @include        http://*.ingress.com/*
// @match          https://*.ingress.com/*
// @match          http://*.ingress.com/*
// @grant          none
// ==/UserScript==

/**
* Copyright 2025 otusscops
*
* Licensed under the Apache License, Version 2.0 (the “License”);
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an “AS IS” BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*
* See the License for the specific language governing permissions and
* limitations under the License.
*/


var wrapper = function(plugin_info) {
    if(typeof window.plugin !== 'function') window.plugin = function() {};

    plugin_info.buildName = 'iitc-ja-otusscops'; // Name of the IITC build for first-party plugins
    plugin_info.dateTimeVersion = '202504091100'; // Datetime-derived version of the plugin
    plugin_info.pluginId = 'RedeemHistory'; // ID/name of the plugin
    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== "function") window.plugin = function () { };
    // ensure plugin framework is there, even if kiwi plugin is not yet loaded
    if (typeof window.plugin.redeemHistory!== "function")
        window.plugin.redeemHistory = function () { };
    // use own namespace for plugin
    window.plugin.redeemHistory = function () {};

    let self = window.plugin.redeemHistory;


    /* プラグイン内でグローバルに用いる定数や変数の定義 */
    const storedDays = 30; // 履歴を保持する日数
    const STORAGE_KEY = 'plugin-redeem-history'; // localStorageのキー名

    // 設定値の保持用
    let RedeemData = {};

    self.loggingRedeemHistory = function(data, textStatus, jqXHR) {
        let status;
        let statusString;
        let rewards;
        let code = jqXHR.passcode;
        let timestamp = new Date().getTime();
        let dateTime = new Date(timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        if(data.hasOwnProperty("error")){
            // エラー時の処理
            status = false;
            statusString = data.error;
            rewards = "-";
        }else if(data.hasOwnProperty("rewards")){
            // 成功時の処理
            status = true;
            statusString = "Success";
            rewards = data.rewards;
        }
        RedeemData[timestamp] = {
            "code": code,
            "dateTime": dateTime,
            "status": status,   // 成功 ture/失敗 false
            "statusString": statusString,
            "rewards": rewards
        }

        // ダイアログが開いているときは再表示
        if(document.querySelector("#dialog-redeemHistoryDialog")){
            self.openHistory();
        }
    };

	// エンドポイントから起動される初期処理用
	// セットアップ以外の処理で、設定変更時等に再度コールされる想定
    self.init = function(){

    };

    // 古い履歴の削除
    self.cleanHistory = function(){
        let times = Object.keys(RedeemData);
        let limitTimestamp = new Date().getTime() - (storedDays * 24 * 60 * 60 * 1000); // storedDays日数分のミリ秒
        let deleteKeys = times.filter(function(key) { return key < limitTimestamp; });
        for (let i = 0; i < deleteKeys.length; i++) {
            delete RedeemData[deleteKeys[i]];
        }
    };

    // Invalidの履歴がないかチェック
    self.checkInvalidHistory = function(inCode){
        inCode = inCode.toLowerCase();
        let times = Object.keys(RedeemData);
        for (let i = 0; i < times.length; i++) {
            let timestamp = times[i];
            let code = RedeemData[timestamp].code.toLowerCase();
            let statusString = self.failedStatusString(RedeemData[timestamp].statusString);
            if(code === inCode){
                // Invalid履歴がある場合は、継続を確認
                return confirm(`${RedeemData[timestamp].dateTime}に\n[ ${RedeemData[timestamp].code} ]は${statusString}です。\nRedeemを継続しますか？`);
            }
        }
        return true; // 無効履歴がない場合はtrueを返す
    }

    // 設定の読み込み
    self.loadOption = function(){
        let stream = localStorage.getItem(STORAGE_KEY);
        let _data = (stream === null) ? {} : JSON.parse(stream);
        RedeemData = _data;
        self.cleanHistory();
    };

    // 設定の保存
    self.saveOption = function(){
        let stream = JSON.stringify(RedeemData);
        localStorage.setItem(STORAGE_KEY,stream);
    };

    self.failedStatusString = function(statusString) {
        if(statusString.match(/Invalid/)){
            return "Invalid";
        }else if(statusString.match(/already/)){
            return "AR";
        }else if(statusString.match(/fully/)){
            return "FR";
        }else{
            return statusString;
        }
    };

    self.openHistory = function() {
        // ダイアログが表示中の場合、位置を維持。
        let myDialog = document.querySelector("#dialog-redeemHistoryDialog");
        let dialogParent, dialogTop, dialogLeft
        if (myDialog) {
            dialogParent = myDialog.parentNode;
            dialogTop = dialogParent.style.top;
            dialogLeft = dialogParent.style.left;
        }

        let times = Object.keys(RedeemData);
        times.sort(function(a, b) {
            return b - a; // 降順にソート
        });
        let html = `
            <table id="iitc-plugin-redeemHistory-table">
                <thead>
                    <tr>
                        <th colspan="4" style="text-align: right;">
                            <input type="text" placeholder="filter" id="redeemHistory-filter">
                            <button id="appendRedeemHistoryFilter">検索</button>
                            <button id="clearRedeemHistoryFilter">クリア</button>
                        </th>
                    </tr>
                    <tr>
                        <th>パスコード</th>
                        <th>日時</th>
                        <th>結果</th>
                        <th>取得内容</th>
                    </tr>
                </thead>
                <tbody>
                    <tr id="redeemDisplayTargetNone" style="${times.length?"display:none;":"display:table-row;"}">
                        <td colspan="4" style="text-align: center;">
                            対象履歴がありません。
                        </td>
                    </tr>
                `;
        // 履歴の表示
        for (let i = 0; i < times.length; i++) {
            let timestamp = times[i];
            let code = RedeemData[timestamp].code;
            let dateTime = RedeemData[timestamp].dateTime;
            let status = RedeemData[timestamp].status;
            let statusString = self.failedStatusString(RedeemData[timestamp].statusString);
            let rewards = RedeemData[timestamp].rewards;
            let rewardString = (status)?self.createRewardString(rewards):'';
            html += `
                    <tr class="redeemData">
                        <td>${code}</td>
                        <td>${dateTime}</td>
                        <td class="${status?"redeemSuccess":"redeemFailer"}">${statusString}</td>
                        <td>${rewardString}</td>
                    </tr>
                `;
        }
        html += `
                </tbody>
            </table>
        `;
        dialog({
            html: html,
            id: 'redeemHistoryDialog',
            title: 'redeem履歴',
            width: 700,
            focusCallback: function() {
                $('#appendRedeemHistoryFilter').on('click', self.filterRows);
                $('#clearRedeemHistoryFilter').on('click', self.clearFilter);
            },
            closeCallback: function() {
                $('#appendRedeemHistoryFilter').off('click', self.filterRows);
                $('#clearRedeemHistoryFilter').off('click', self.clearFilter);
            },
        });

        // ダイアログの位置を保持
        if(myDialog){
            myDialog = document.querySelector("#dialog-redeemHistoryDialog");
            dialogParent = myDialog.parentNode;
            dialogParent.style.top = dialogTop;
            dialogParent.style.left = dialogLeft;
        }
    };

    self.createRewardString = function(rewards) {
        return window.formatPasscodeLong (rewards);
    }


    /* Table filter and sort */
    // https://alpha3166.github.io/blog/20221123.html
    self.filterRows = function() {
        const keyword = document.querySelector('#redeemHistory-filter').value;
        const regex = new RegExp(keyword, 'i');
        const rows = document.querySelectorAll('#iitc-plugin-redeemHistory-table tbody tr.redeemData');
        let count = 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            row.style.display = 'none';
            if (row.cells[0].textContent.match(regex)) {
                row.style.display = 'table-row';
                count++;
            }
        }
        if(count){
            document.querySelector("#redeemDisplayTargetNone").style.display = "none";
        }else{
            document.querySelector("#redeemDisplayTargetNone").style.display = "table-row";
        }
    }

    self.clearFilter = function(){
        document.querySelector('#redeemHistory-filter').value = '';
        self.filterRows();
    }


    // The entry point for this plugin.
    self.start = async function() {
        // 設定値の読み込み
        self.loadOption();

        /* ツールボックスの項目追加 */
        $('#toolbox').append('<a onclick="javascript:window.plugin.redeemHistory.openHistory();">redeem履歴</a>');
        // redeem keypressのフック
        let redeemEvents = $._data($("#redeem").get(0), "events");
        let originalKeypressHandler  = redeemEvents.keypress[0].handler;
        $("#redeem").off("keypress", originalKeypressHandler);
        $("#redeem").on("keypress", function (e) {
            if (e.keyCode === 13) {
                let code = $(this).val();
                // Invalid履歴がある場合は、継続を確認
                if(!self.checkInvalidHistory(code)){
                    e.preventDefault();
                    return false;
                }
            }
            originalKeypressHandler.call(this, e);
        });
        // redeem responseのフック
		let originalRedeemResponse = handleRedeemResponse;
		window.handleRedeemResponse = function (data, textStatus, jqXHR) {
			originalRedeemResponse(data, textStatus, jqXHR);
            self.loggingRedeemHistory(data, textStatus, jqXHR);
            self.cleanHistory();
            self.saveOption();
		}

        let cssData = `
/* CSS */
#iitc-plugin-redeemHistory-table {
    width: 100%;
}
#iitc-plugin-redeemHistory-table td {
    vertical-align: middle; border: 1px solid gray;
}
#iitc-plugin-redeemHistory-table th {
    vertical-align: middle;
    border: 1px solid gray;
}

.redeemSuccess{
    color:#4BF36C;
}
.redeemFailer{
    color:#F34B76;
}
        `;
        let styleTag = document.createElement('style');
        styleTag.setAttribute('type', 'text/css')
        styleTag.innerText = cssData;
        document.getElementsByTagName('head')[0].insertAdjacentElement('beforeend', styleTag);

        // 初期設定
        self.init()
    };


    const setup = self.start;
    // PLUGIN END //////////////////////////////////////////////////////////



    setup.info = plugin_info; // Add an info property for IITC's plugin system
    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded && typeof setup === 'function') setup();
}


var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode(`(${wrapper})(${JSON.stringify(info)});`));
(document.body || document.head || document.documentElement).appendChild(script);