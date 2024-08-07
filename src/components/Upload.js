// src/components/Upload.js
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import CodeBlock from './CodeBlock';

const DataTypeToApexType = {
    'Id': 'String',
    'Text': 'String',
    'Picklist': 'String',
    'Long Text Area': 'String',
    'Auto Number': 'String',
    'Date': 'Date',
    'Date/Time': 'DateTime',
    'Currency': 'Decimal',
    'Number': 'Decimal',
    'CheckBox': 'Boolean',
}

const DataTypeToSqliteType = {
    'Id': 'TEXT',
    'Text': 'TEXT',
    'Picklist': 'TEXT',
    'Long Text Area': 'TEXT',
    'Auto Number': 'TEXT',
    'Date': 'DATE',
    'Date/Time': 'DATE',
    'Currency': 'NUMERIC',
    'Number': 'NUMERIC',
    'CheckBox': 'NUMERIC',
}

const DataTypeToSqliteValue = {
    'Id': '\'\'',
    'Text': '\'\'',
    'Picklist': '\'\'',
    'Long Text Area': '\'\'',
    'Auto Number': '\'\'',
    'Date': '\'\'',
    'Date/Time': '\'\'',
    'Currency': '0',
    'Number': '0',
    'CheckBox': '0',
}

const Upload = () => {
    const [data, setData] = useState([]);
    const [requestConfig, setRequestConfig] = useState('');
    const [baseRequest, setBaseRequest] = useState('');
    const [loadBaseDataDoPost, setLoadBaseDataDoPost] = useState('');
    const [syncStampData, setSyncStampData] = useState('');
    const [returnData, setReturnData] = useState('');

    const [databaseManager, setDatabaseManager] = useState('');
    const [databaseManagerSystemTableCode, setDatabaseManagerSystemTableCode] = useState('');
    const [databaseManagerSystemDataCode, setDatabaseManagerSystemDataCode] = useState('');
    const [databaseManagerGetSystemInfo, setDatabaseManagerGetSystemInfo] = useState('');

    const [syncControllerInBaseQuery, setSyncControllerInBaseQuery] = useState('');
    const [syncControllerInDeleteArray, setSyncControllerInDeleteArray] = useState('');
    const [syncControllerInSyncSystemData, setSyncControllerInSyncSystemData] = useState('');
    const [syncControllerInInsertQuery, setSyncControllerInInsertQuery] = useState('');

    const generateRequestConfig = (workbook) => {
        let requestConfigCode = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const fields = objectData.map(item => item.apiName.trim());
            console.log('fields =>', fields);

            requestConfigCode += `global class ${formattedObjectName}Config extends RequestConfig {\n`;
            requestConfigCode += `\tpublic ${formattedObjectName}Config (LoadBaseData.SyncData lastStamp, Integer queryLimit) {\n`;
            requestConfigCode += `\t\tsuper(lastStamp, queryLimit);\n`;
            requestConfigCode += `\t}\n\n`;
            requestConfigCode += `\tpublic override String getType() {\n`;
            requestConfigCode += `\t\treturn '${objectName}';\n`;
            requestConfigCode += `\t}\n\n`;
            requestConfigCode += `\tpublic override Set<String> getFields() {\n`;
            requestConfigCode += `\t\treturn new Set<String>{\n`;
            fields.forEach((field, index) => {
                requestConfigCode += `\t\t\t\'${field}\'`;
                if (index + 1 !== fields.length) {
                    requestConfigCode += `,\n`
                } else {
                    requestConfigCode += '\n'
                }
            })
            requestConfigCode += `\t\t};\n`;
            requestConfigCode += `\t}\n`;
            requestConfigCode += `}\n\n`;
        })

        return requestConfigCode;
    }

    function formatVariable(str) {
        let formattedString = str.replace(/\s+/g, '');

        formattedString = formattedString.replace(/__c|__r|\./g, '');

        if (formattedString.length > 0) {
            formattedString = formattedString.charAt(0).toLowerCase() + formattedString.slice(1);
        }

        return formattedString;
    }

    const generateBaseRequest = (workbook) => {
        let baseRequestCode = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const formattedApiFieldsMap = {};
            apiFields.forEach(item => {
                let formattedVar = formatVariable(item.apiName)
                if (formattedVar === 'isDeleted') {
                    formattedVar = 'deleted';
                }
                formattedApiFieldsMap[formattedVar] = item;
            });
            console.log('formattedApiFieldsMap =>', formattedApiFieldsMap);

            baseRequestCode += `global class ${formattedObjectName}Request extends BaseRequest {\n`;
            baseRequestCode += `\t@TestVisible\n`;
            Object.keys(formattedApiFieldsMap).forEach(key => {
                if (key != 'id') {
                    const obj = formattedApiFieldsMap[key];
                    baseRequestCode += `\tList<${DataTypeToApexType[obj.dataType]}> ${key};\n`;
                }
            })
            baseRequestCode += `\n`;
            baseRequestCode += `\tpublic ${formattedObjectName}Request(){\n`;
            baseRequestCode += `\t\tsuper();\n`;
            Object.keys(formattedApiFieldsMap).forEach(key => {
                const obj = formattedApiFieldsMap[key];
                baseRequestCode += `\t\tthis.${key} = new List<${DataTypeToApexType[obj.dataType]}>();\n`;
            })
            baseRequestCode += `\t}\n\n`;
            baseRequestCode += `\tpublic override void parseData(SObject sobj){\n`;
            baseRequestCode += `\t\t${objectName} data = (${objectName})sobj;\n`;
            Object.keys(formattedApiFieldsMap).forEach(key => {
                const obj = formattedApiFieldsMap[key];
                baseRequestCode += `\t\tthis.${key}.add(data.${obj.apiName});\n`;
            })
            baseRequestCode += `\t}\n`;
            baseRequestCode += `}\n`;
            baseRequestCode += `\n\n`;
        })

        return baseRequestCode;
    }

    const generateLoadBaseDataDoPost = (workbook) => {
        let loadBaseDataDoPostCode = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const smallObjectName = formatVariable(objectName);
            loadBaseDataDoPostCode += `
{ // Object => 	${objectName}
    if (availableRows(queryLimit, '${objectName}') && lastSyncStamp.${smallObjectName}Sync != null) {
        System.debug('// Object => 	${objectName}');
        BaseRequest.${formattedObjectName}Request request = new BaseRequest.${formattedObjectName}Request(); 

        specific = request.fillRequest(
            new RequestConfig.${formattedObjectName}Config(
                validateLastSync(lastSyncStamp.${smallObjectName}Sync),
                queryLimit
            )
        );

        queryLimit = updateLimit(queryLimit, request.getSize());
        if (request.getLastStamp().lastSyncStamp != null) {
            lastSyncStamp.${smallObjectName}Sync = request.getLastStamp();
        }
        returnData.addRequest(request);
        hasMore = verifyHasMore(hasMore, specific);
    }
}
        `;
        })

        return loadBaseDataDoPostCode;
    }

    const generateSyncStampData = (workbook) => {
        let syncStampData = `
global class SyncStampData {`;
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const smallObjectName = formatVariable(objectName);
            const fields = objectData.map(item => item.apiName.trim());
            console.log('fields =>', fields);
            const formattedFields = '\n\t\t\t \'' + fields.join('\',\n\t\t\t \'') + '\'';
            // '${objectData.map(item => item.apiName).join('\',\n \'')}',
            syncStampData += `
    public SyncData ${smallObjectName}Sync {get; set;}`;
        })

        syncStampData += `
}`;

        return syncStampData;
    }

    const generateReturnData = (workbook) => {
        let returnDataCode = `
global class ReturnData{
    public UserData userData;
    public SyncStampData syncData;
    public ReturnError error;
    public Boolean hasMore;
    public String appVersion;
`;

        let returnDataCodeP1 = '';
        let returnDataCodeP2 = `

    public void addRequest(BaseRequest request){
    `;

        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const smallObjectName = formatVariable(objectName);
            const fields = objectData.map(item => item.apiName.trim());
            console.log('fields =>', fields);
            const formattedFields = '\n\t\t\t \'' + fields.join('\',\n\t\t\t \'') + '\'';
            // '${objectData.map(item => item.apiName).join('\',\n \'')}',
            returnDataCodeP1 += `
    public BaseRequest.${formattedObjectName}Request ${smallObjectName}Request;`;

            returnDataCodeP2 += `
        if (request instanceof BaseRequest.${formattedObjectName}Request)
            this.${smallObjectName}Request  = (BaseRequest.${formattedObjectName}Request)request;`;
        })
        
        returnDataCodeP2 += `
    }
`;

        returnDataCode += returnDataCodeP1;
        returnDataCode += returnDataCodeP2;
        returnDataCode += `
    public ReturnData(UserData userData, String appVersion){
        this.userData   = userData;
        this.hasMore    = false;
        this.appVersion = appVersion;
    }
} `;

        return returnDataCode;
    }

    function generateSqliteFieldNames(baseName, apiArray) {
        const array = [];
        apiArray.forEach(item => {
            if (item.apiName === "SystemModStamp" || item.apiName === "IsDeleted") {

            } else {
                let apiName = item.apiName.replace(/__c|__r/g, '');

                apiName = apiName.replace(/\./g, '_');
                apiName = apiName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

                const sqliteFieldName = generateSqliteFieldName(baseName);
                
                array.push({fieldName: `${sqliteFieldName}_${apiName}${item.apiName === 'Id' ? 'X' : ''}`, dataType: item.dataType});
            }
            
        });

        return array;
    }

    function generateSqliteFieldName(objectName) {
        let apiName = objectName.replace(/__c|__r/g, '');

        apiName = apiName.replace(/\./g, '_');
        apiName = apiName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
            
        return apiName;
    }

    const generateDatabaseManager = (workbook) => {
        let databaseManagerCode = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const fieldNames = generateSqliteFieldNames(formattedObjectName, apiFields);
            console.log('fieldNames =>', fieldNames);

            const sqliteFieldName = generateSqliteFieldName(objectName);
            console.log('sqliteFieldName =>', sqliteFieldName);

            databaseManagerCode += `tx.executeSql(\n`;
            databaseManagerCode += `\t\`CREATE TABLE IF NOT EXISTS ${sqliteFieldName}(\n`;

            databaseManagerCode += `\t\t${sqliteFieldName}_ID INTEGER PRIMARY KEY AUTOINCREMENT,\n`;

            fieldNames.forEach(item => {
                databaseManagerCode += `\t\t${item.fieldName} ${DataTypeToSqliteType[item.dataType]} NOT NULL DEFAULT ${DataTypeToSqliteValue[item.dataType]},\n`;
            })

            databaseManagerCode += `\t\tERROR_SYNC NUMERIC NOT NULL DEFAULT 0,\n`;
            databaseManagerCode += `\t\tERROR_SYNC_MESSAGE TEXT NOT NULL DEFAULT '',\n`;
            databaseManagerCode += `\t\tDELETED NUMERIC NOT NULL DEFAULT 0,\n`;
            databaseManagerCode += `\t\tSYNC_STATUS NUMERIC NOT NULL DEFAULT 0\n`;

            databaseManagerCode += `\t);\`\n`;
            databaseManagerCode += `);\n`;
            databaseManagerCode += `\n\n`;
        })

        return databaseManagerCode;
    }

    const generateDatabaseManagerSystemTable = (workbook) => {
        let databaseManagerCode = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const sqliteFieldName = generateSqliteFieldName(objectName);

            databaseManagerCode += `LAST_SYNC_${sqliteFieldName} NUMERIC DEFAULT 0,\n`;
            databaseManagerCode += `LAST_SYNC_${sqliteFieldName}_ID TEXT DEFAULT '',\n`;
        })

        return databaseManagerCode;
    }

    const generateDatabaseManagerSystemData = (workbook) => {
        let databaseManagerCode = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            databaseManagerCode += `lastSync${formattedObjectName}Data: string;\n`;
            databaseManagerCode += `lastSync${formattedObjectName}DataId: string;\n`;
        })

        return databaseManagerCode;
    }

    const generateDatabaseManagerGetSystemInfo = (workbook) => {
        let databaseManagerCode = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const sqliteFieldName = generateSqliteFieldName(objectName);

            databaseManagerCode += `lastSync${formattedObjectName}Data: rows.item(0).LAST_SYNC_${sqliteFieldName},\n`;
            databaseManagerCode += `lastSync${formattedObjectName}DataId: rows.item(0).LAST_SYNC_${sqliteFieldName}_ID,\n`;
        })

        return databaseManagerCode;
    }

    const generateSyncControllerInBaseQuery = (workbook) => {
        let code = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const fieldNames = generateSqliteFieldNames(formattedObjectName, apiFields);
            console.log('fieldNames =>', fieldNames);

            const sqliteFieldName = generateSqliteFieldName(objectName);

            code += `${sqliteFieldName}:\n`;
            code += `\t\`INSERT OR REPLACE INTO ${sqliteFieldName}\n`;
            code += `\t\t(\n`;

            code += `\t\t\t${sqliteFieldName}_ID, \n`;

            fieldNames.forEach((item, index) => {
                code += `\t\t\t${item.fieldName}, \n`;
            })

            code += `\t\t\tSYNC_STATUS \n`;
            
            code += `\t\t) VALUES\`,\n`;

            code += `\n\n`;
        })

        return code;
    }

    const generateSyncControllerInDeleteArray = (workbook) => {
        let code = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const sqliteFieldName = generateSqliteFieldName(objectName);

            code += `${sqliteFieldName}: [],\n`;
        })

        return code;
    }

    const generateSyncControllerInSyncSystemData = (workbook) => {
        let code = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const smallObjectName = formatVariable(objectName);

            const sqliteFieldName = generateSqliteFieldName(objectName);

            code += `if (received?.syncData?.${smallObjectName}Sync && received?.syncData?.${smallObjectName}Sync?.lastSyncStamp) {\n`;
            code += `\tquery += \` , LAST_SYNC_${sqliteFieldName} = '\${received.syncData.${smallObjectName}Sync.lastSyncStamp}'\`;\n`;
            code += `\tquery += \` , LAST_SYNC_${sqliteFieldName}_ID = '\${received.syncData.${smallObjectName}Sync.lastSyncId}'\`;\n`;
            code += `}\n`;
        })

        return code;
    }

    const generateSyncControllerInInsertQuery = (workbook) => {
        let code = '';
        workbook.SheetNames.forEach(objectName => {
            console.log('objectName =>', objectName);
            const sheet = workbook.Sheets[objectName];
            const objectData = XLSX.utils.sheet_to_json(sheet);
            console.log('objectData =>', objectData);
            
            const formattedObjectName = objectName.replace('__c', '').trim();
            const apiFields = objectData.map(item => { return { apiName: item.apiName.trim(), dataType: item.dataType } });
            console.log('apiFields =>', apiFields);

            const formattedApiFieldsMap = {};
            apiFields.forEach(item => {
                let formattedVar = formatVariable(item.apiName)
                if (formattedVar === 'isDeleted') {
                    formattedVar = 'deleted';
                }
                formattedApiFieldsMap[formattedVar] = item;
            });
            console.log('formattedApiFieldsMap generateSyncControllerInInsertQuery =>', formattedApiFieldsMap);

            const smallObjectName = formatVariable(objectName);

            const sqliteFieldName = generateSqliteFieldName(objectName);

            code += `// ${sqliteFieldName}\n`;
            code += `if (\n`;
            code += `\treceived.${smallObjectName}Request &&\n`;
            code += `\treceived.${smallObjectName}Request.id.length > 0\n`;
            code += `) {\n`;

            code += `\t\tcurrLength = received.${smallObjectName}Request.id.length;  \n`;
            code += `\t\tqueryBuffer = baseQuery["${sqliteFieldName}"];  \n`;
            code += `\t\tvar hasBuffer = false;  \n`;
            code += `\t\tfor (var i = 0; i < currLength; i++) {  \n`;

            code += `\t\t\tif (received.${smallObjectName}Request.deleted[i]) {  \n`;
            code += `\t\t\t\tdeletedArray["${sqliteFieldName}"].push(received.${smallObjectName}Request.id[i]);  \n`;
            code += `\t\t\t} else {  \n`;

            code += `\t\t\t\tconst useNullOrValue = firstLoadBaseData ? "null" : \` (SELECT ${sqliteFieldName}_ID FROM ${sqliteFieldName} WHERE ${sqliteFieldName}_IDX = '\${received.${smallObjectName}Request.id[i]}' ) \`;  \n\n`;
            code += `\t\t\t\tqueryBuffer +=  \n`;
            code += `\t\t\t\t\t(hasBuffer ? "," : "") +  \n`;
            code += `\t\t\t\t\t\`(  \n`;
            code += `\t\t\t\t\t\t\${useNullOrValue},  \n`;

            Object.keys(formattedApiFieldsMap).forEach(key => {
                if (key === 'deleted' || key === 'isDeleted' || key === 'systemModStamp') {

                } else {
                    code += `\t\t\t\t\t\t'\${stringEscape(received.${smallObjectName}Request.${key}[i])}',\n`;
                }
            })

            code += `\t\t\t\t\t\t'1'  \n`;
            code += `\t\t\t\t\t)\`;  \n`;
            

            code += `\t\t\t\thasBuffer = true; \n`;
            code += `\t\t\t\tif (queryBuffer.length > maxLength) { \n`;
            code += `\t\t\t\t\tgroupQuery.push(\`\${queryBuffer};\`); \n`;
            code += `\t\t\t\t\tqueryBuffer = baseQuery["${sqliteFieldName}"]; \n`;
            code += `\t\t\t\t\thasBuffer = false; \n`;
            code += `\t\t\t\t} \n`;

            code += `\t\t\t} \n`;

            code += `\t\t}  \n\n`;

            code += `\t\tif (hasBuffer) groupQuery.push(queryBuffer); \n`;
            code += `\t\tif (deletedArray["${sqliteFieldName}"].length > 0) { \n`;
            code += `\t\t\tgroupQuery.push( \n`;
            code += `\t\t\t\t\`DELETE FROM ${sqliteFieldName} \n`;
            code += `\t\t\t\t\tWHERE ${sqliteFieldName}_IDX IN ('\${deletedArray["${sqliteFieldName}"].join("','")}')\`\n`;
            code += `\t\t\t); \n`;
            code += `\t\t} \n`;

            code += `}\n`;
        })

        return code;
    }

    const onDrop = useCallback((acceptedFiles) => {
        const file = acceptedFiles[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const binaryStr = e.target.result;
            const workbook = XLSX.read(binaryStr, { type: 'binary' });
            console.log('workbook =>', workbook);

            let requestConfigCode = generateRequestConfig(workbook);;
            let baseRequestCode = generateBaseRequest(workbook);
            let loadBaseDataDoPostCode = generateLoadBaseDataDoPost(workbook);
            let syncStampDataCode = generateSyncStampData(workbook);
            let returnDataCode = generateReturnData(workbook);
            let databaseManagerCode = generateDatabaseManager(workbook);
            let databaseManagerSystemTableCode = generateDatabaseManagerSystemTable(workbook);
            let databaseManagerSystemDataCode = generateDatabaseManagerSystemData(workbook);
            let databaseManagerGetSystemInfoCode = generateDatabaseManagerGetSystemInfo(workbook);
            let syncControllerInBaseQueryCode = generateSyncControllerInBaseQuery(workbook);
            let syncControllerInDeleteArrayCode = generateSyncControllerInDeleteArray(workbook);
            let syncControllerInSyncSystemDataCode = generateSyncControllerInSyncSystemData(workbook);
            let syncControllerInInsertQueryCode = generateSyncControllerInInsertQuery(workbook);

            setRequestConfig(requestConfigCode);
            setBaseRequest(baseRequestCode);
            setLoadBaseDataDoPost(loadBaseDataDoPostCode);
            setSyncStampData(syncStampDataCode);
            setReturnData(returnDataCode);
            setDatabaseManager(databaseManagerCode);
            setDatabaseManagerSystemTableCode(databaseManagerSystemTableCode);
            setDatabaseManagerSystemDataCode(databaseManagerSystemDataCode);
            setDatabaseManagerGetSystemInfo(databaseManagerGetSystemInfoCode);
            setSyncControllerInBaseQuery(syncControllerInBaseQueryCode);
            setSyncControllerInDeleteArray(syncControllerInDeleteArrayCode);
            setSyncControllerInSyncSystemData(syncControllerInSyncSystemDataCode);
            setSyncControllerInInsertQuery(syncControllerInInsertQueryCode);
        };

        reader.readAsBinaryString(file);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    return (
        <div>
            <h2>Upload de Arquivo Excel</h2>
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} accept=".xlsx, .xls" />
                {isDragActive ? (
                    <p>Solte o arquivo aqui...</p>
                ) : (
                    <p>Arraste e solte o arquivo aqui, ou clique para selecionar o arquivo</p>
                )}
            </div>
            <CodeBlock code={databaseManager} language={'javascript'} title={'DatabaseManager'} />
            <CodeBlock code={databaseManagerSystemTableCode} language={'javascript'} title={'DatabaseManager SYSTEM Table'} />
            <CodeBlock code={databaseManagerSystemDataCode} language={'javascript'} title={'DatabaseManager SystemData'} />
            <CodeBlock code={databaseManagerGetSystemInfo} language={'javascript'} title={'DatabaseManager getSystemInfo'} />
            <CodeBlock code={syncControllerInInsertQuery} language={'javascript'} title={'SyncControllerIn insertQuery'} />

            <CodeBlock code={syncControllerInBaseQuery} language={'javascript'} title={'SyncControllerIn baseQuery'} />
            <CodeBlock code={syncControllerInDeleteArray} language={'javascript'} title={'SyncControllerIn deleteArray'} />
            <CodeBlock code={syncControllerInSyncSystemData} language={'javascript'} title={'SyncControllerIn syncSystemData'} />
            

            <CodeBlock code={requestConfig} language={'apex'} title={'RequestConfig'} />
            <CodeBlock code={baseRequest} language={'apex'} title={'BaseRequest'} />
            <CodeBlock code={loadBaseDataDoPost} language={'apex'} title={'LoadBaseData doPost'} />
            <CodeBlock code={syncStampData} language={'apex'} title={'LoadBaseData SyncStampData'} />
            <CodeBlock code={returnData} language={'apex'} title={'LoadBaseData ReturnData'} />
        </div>
    );
};

export default Upload;
