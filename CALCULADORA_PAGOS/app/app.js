// app.js

// State variables
let tablaOferta = {}; // Formato: { "GLOBAL AIR": { "Actividad 1": 100, ... }, "ENERGY SYSTEM": { ... } }
let currentOTData = []; // Array de objetos con datos de la OT
let selectedProvider = 'ALL';
let providerDeductions = {}; // { "GLOBAL AIR": { 1: [{name, amount}], 2: [], ... } }
let providerFacturas = {}; // { provider: { month: { 1: "FAC", 2: "" } } }
let providerExtras = {}; // { provider: { month: { 1: [{orden, actividad, valor}], ... } } }

// DOM Elements
const btnConfig = document.getElementById('btn-config');
const setupOverlay = document.getElementById('setup-overlay');
const closeSetup = document.getElementById('close-setup');
const dropZoneOferta = document.getElementById('drop-zone-oferta');
const inputOferta = document.getElementById('input-oferta');

const dropZoneOT = document.getElementById('drop-zone-ot');
const inputOT = document.getElementById('input-ot');
const tableBody = document.getElementById('table-body');
const summaryCards = document.getElementById('summary-cards');

// Normalizador global del nombre de proveedor
function normalizeProviderName(name) {
    if (!name) return '';
    const upper = name.trim().toUpperCase();
    if (upper === 'ENERGY' || upper === 'ENERGY SYSTEMS' || upper === 'ENERGY SYSTEM') {
        return 'ENERGY SYSTEM';
    }
    return name.trim();
}

function setupEnergyAliases() {
    if (!tablaOferta || typeof tablaOferta !== 'object') return;
    if (tablaOferta['ENERGY SYSTEM']) {
        try {
            Object.defineProperty(tablaOferta, 'ENERGY', {
                get: function() { return this['ENERGY SYSTEM']; },
                set: function(v) { this['ENERGY SYSTEM'] = v; },
                enumerable: false,
                configurable: true
            });
            Object.defineProperty(tablaOferta, 'ENERGY SYSTEMS', {
                get: function() { return this['ENERGY SYSTEM']; },
                set: function(v) { this['ENERGY SYSTEM'] = v; },
                enumerable: false,
                configurable: true
            });
        } catch (e) {}
    }
}

function consolidateEnergyProvider() {
    if (tablaOferta && typeof tablaOferta === 'object') {
        if (!tablaOferta['ENERGY SYSTEM']) {
            tablaOferta['ENERGY SYSTEM'] = {};
        }
        if (tablaOferta['ENERGY']) {
            Object.assign(tablaOferta['ENERGY SYSTEM'], tablaOferta['ENERGY']);
            delete tablaOferta['ENERGY'];
        }
        if (tablaOferta['ENERGY SYSTEMS']) {
            Object.assign(tablaOferta['ENERGY SYSTEM'], tablaOferta['ENERGY SYSTEMS']);
            delete tablaOferta['ENERGY SYSTEMS'];
        }
        setupEnergyAliases();
        localStorage.setItem('calcPago_tablaOferta', JSON.stringify(tablaOferta));
    }

    if (Array.isArray(currentOTData)) {
        currentOTData.forEach(d => {
            if (d.proveedor === 'ENERGY' || d.proveedor === 'ENERGY SYSTEMS') {
                d.proveedor = 'ENERGY SYSTEM';
            }
        });
    }

    // Unificar deducciones, facturas y extras si venían con nombre legacy
    [providerDeductions, providerFacturas, providerExtras].forEach(obj => {
        if (obj && typeof obj === 'object') {
            if (!obj['ENERGY SYSTEM']) obj['ENERGY SYSTEM'] = {};
            if (obj['ENERGY']) {
                Object.assign(obj['ENERGY SYSTEM'], obj['ENERGY']);
                delete obj['ENERGY'];
            }
            if (obj['ENERGY SYSTEMS']) {
                Object.assign(obj['ENERGY SYSTEM'], obj['ENERGY SYSTEMS']);
                delete obj['ENERGY SYSTEMS'];
            }
        }
    });

    if (selectedProvider === 'ENERGY' || selectedProvider === 'ENERGY SYSTEMS') {
        selectedProvider = 'ENERGY SYSTEM';
    }

    // Limpiar también en calcPago_workspaceState de localStorage
    try {
        const wsStr = localStorage.getItem('calcPago_workspaceState');
        if (wsStr) {
            const ws = JSON.parse(wsStr);
            if (ws.tablaOferta) {
                if (!ws.tablaOferta['ENERGY SYSTEM']) ws.tablaOferta['ENERGY SYSTEM'] = {};
                if (ws.tablaOferta['ENERGY']) {
                    Object.assign(ws.tablaOferta['ENERGY SYSTEM'], ws.tablaOferta['ENERGY']);
                    delete ws.tablaOferta['ENERGY'];
                }
                if (ws.tablaOferta['ENERGY SYSTEMS']) {
                    Object.assign(ws.tablaOferta['ENERGY SYSTEM'], ws.tablaOferta['ENERGY SYSTEMS']);
                    delete ws.tablaOferta['ENERGY SYSTEMS'];
                }
            }
            if (Array.isArray(ws.currentOTData)) {
                ws.currentOTData.forEach(item => {
                    item.proveedor = normalizeProviderName(item.proveedor);
                });
            }
            if (ws.selectedProvider) {
                ws.selectedProvider = normalizeProviderName(ws.selectedProvider);
            }
            localStorage.setItem('calcPago_workspaceState', JSON.stringify(ws));
        }
    } catch (e) {}
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const savedOferta = localStorage.getItem('calcPago_tablaOferta');
    if (savedOferta) {
        try {
            tablaOferta = JSON.parse(savedOferta);
        } catch(e) {}
    }
    
    // Auto-restaurar estado de la sesión guardado previamente
    const savedStateStr = localStorage.getItem('calcPago_workspaceState');
    if (savedStateStr) {
        try {
            const state = JSON.parse(savedStateStr);
            if (state.tablaOferta) tablaOferta = state.tablaOferta;
            if (state.currentOTData && state.currentOTData.length > 0) {
                currentOTData = state.currentOTData.map(d => ({
                    ...d,
                    proveedor: normalizeProviderName(d.proveedor),
                    fechaObj: d.fechaObj ? new Date(d.fechaObj) : new Date()
                }));
            }
            if (state.providerDeductions) providerDeductions = state.providerDeductions;
            if (state.providerFacturas) providerFacturas = state.providerFacturas;
            if (state.providerExtras) providerExtras = state.providerExtras;
            if (state.selectedProvider) selectedProvider = normalizeProviderName(state.selectedProvider);

            consolidateEnergyProvider();
            updateInitialProviderSelect();
            updateManageProviderSelect();
            updateMonthFilter();
            renderTable();
            calculateAndRenderSummary();
            updateProviderPricesTable();
            console.log("Área de trabajo restaurada automáticamente desde memoria.");
        } catch (err) {
            console.error("Error al restaurar área de trabajo previa:", err);
        }
    } else {
        consolidateEnergyProvider();
        if (Object.keys(tablaOferta).length > 0) {
            updateInitialProviderSelect();
            updateManageProviderSelect();
        } else {
            setupOverlay.classList.remove('hidden');
        }
    }
});

// -- Setup Modal Events --
btnConfig.addEventListener('click', () => setupOverlay.classList.remove('hidden'));
closeSetup.addEventListener('click', () => setupOverlay.classList.add('hidden'));

// -- Manual OT Overlay Logic --
const btnOpenManualOT = document.getElementById('btn-open-manual-ot');
const manualActivityOverlay = document.getElementById('manual-activity-overlay');
const closeManual = document.getElementById('close-manual');
const saveManual = document.getElementById('save-manual');

if (btnOpenManualOT && manualActivityOverlay) {
    btnOpenManualOT.addEventListener('click', () => {
        const manualProviderSelect = document.getElementById('manual-provider');
        const manualMonthSelect = document.getElementById('manual-month');
        const manualDateInput = document.getElementById('manual-date');
        
        if (manualDateInput && !manualDateInput.value) {
            manualDateInput.value = new Date().toISOString().split('T')[0];
        }

        if (manualProviderSelect) {
            manualProviderSelect.innerHTML = '';
            const providers = Object.keys(tablaOferta);
            if (providers.length === 0) {
                manualProviderSelect.innerHTML = '<option value="">-- Sin Proveedores --</option>';
            } else {
                providers.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p;
                    if (selectedProvider !== 'ALL' && p === selectedProvider) {
                        opt.selected = true;
                    }
                    manualProviderSelect.appendChild(opt);
                });
            }
        }

        if (manualMonthSelect) {
            const currentMonthFilter = document.getElementById('month-filter')?.value;
            if (currentMonthFilter && currentMonthFilter !== 'ALL') {
                manualMonthSelect.value = currentMonthFilter;
            }
        }

        manualActivityOverlay.classList.remove('hidden');
    });

    closeManual?.addEventListener('click', () => {
        manualActivityOverlay.classList.add('hidden');
    });

    saveManual?.addEventListener('click', () => {
        const orden = document.getElementById('manual-order')?.value.trim();
        const rawDate = document.getElementById('manual-date')?.value;
        const proveedor = document.getElementById('manual-provider')?.value;
        const mes = document.getElementById('manual-month')?.value;
        const actividad = document.getElementById('manual-activity')?.value.trim();

        if (!orden) {
            alert("Por favor ingrese el Número de Orden / OT.");
            return;
        }
        if (!proveedor) {
            alert("Por favor seleccione un Proveedor.");
            return;
        }
        if (!actividad) {
            alert("Por favor ingrese la Actividad.");
            return;
        }

        let formattedDate = '';
        if (rawDate) {
            const parts = rawDate.split('-');
            if (parts.length === 3) {
                formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
                formattedDate = rawDate;
            }
        } else {
            formattedDate = new Date().toLocaleDateString('es-NI');
        }

        const newOT = {
            id: 'manual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            orden: orden,
            fecha: formattedDate,
            actividad: actividad,
            proveedor: proveedor,
            mes: mes || 'JUNIO',
            semana: null,
            isManual: true
        };

        currentOTData.unshift(newOT);
        renderTable();
        calculateAndRenderSummary();

        document.getElementById('manual-order').value = '';
        document.getElementById('manual-activity').value = '';
        manualActivityOverlay.classList.add('hidden');

        alert(`¡OT ${orden} agregada con éxito! Aparece en la lista para que le selecciones la semana cuando desees.`);
    });
}

// Drag and drop setup
setupDragAndDrop(dropZoneOferta, inputOferta, handleOfertaUpload);
setupDragAndDrop(dropZoneOT, inputOT, handleOTUpload);

// -- Tabs Logic --
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-target')).classList.add('active');
    });
});

// -- Provider Management Logic --
const manageProviderSelect = document.getElementById('manage-provider-select');
const btnAddProvider = document.getElementById('btn-add-provider');
const providerEditor = document.getElementById('provider-editor');
const editProviderName = document.getElementById('edit-provider-name');
const btnSaveProvider = document.getElementById('btn-save-provider');
const btnDeleteProvider = document.getElementById('btn-delete-provider');
const activitiesList = document.getElementById('activities-list');
const btnAddActivity = document.getElementById('btn-add-activity');

let currentEditingProvider = null; // null means new provider

manageProviderSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
        openProviderEditor(val);
    } else {
        providerEditor.classList.add('hidden');
    }
});

btnAddProvider.addEventListener('click', () => {
    manageProviderSelect.value = '';
    openProviderEditor(null);
});

function openProviderEditor(providerName) {
    providerEditor.classList.remove('hidden');
    currentEditingProvider = providerName;
    activitiesList.innerHTML = '';
    
    if (providerName) {
        editProviderName.value = providerName;
        btnDeleteProvider.classList.remove('hidden');
        const activities = tablaOferta[providerName] || {};
        Object.keys(activities).forEach(act => {
            addActivityRow(act, activities[act]);
        });
    } else {
        editProviderName.value = '';
        btnDeleteProvider.classList.add('hidden');
        addActivityRow('', 0);
    }
}

function addActivityRow(name = '', price = 0) {
    const row = document.createElement('div');
    row.className = 'activity-row';
    row.innerHTML = `
        <input type="text" class="custom-input act-name" placeholder="Nombre de Actividad" value="${name}">
        <input type="number" class="custom-input act-price" placeholder="Precio" value="${price}">
        <button class="btn-icon btn-remove-act">✖</button>
    `;
    row.querySelector('.btn-remove-act').addEventListener('click', () => row.remove());
    activitiesList.appendChild(row);
}

btnAddActivity.addEventListener('click', () => addActivityRow());

btnSaveProvider.addEventListener('click', () => {
    const newName = editProviderName.value.trim().toUpperCase();
    if (!newName) {
        alert("El nombre del proveedor es requerido.");
        return;
    }
    
    const newActivities = {};
    const rows = activitiesList.querySelectorAll('.activity-row');
    rows.forEach(row => {
        const actName = row.querySelector('.act-name').value.trim();
        const actPrice = parseFloat(row.querySelector('.act-price').value) || 0;
        if (actName) {
            newActivities[actName] = actPrice;
        }
    });

    if (currentEditingProvider && currentEditingProvider !== newName) {
        delete tablaOferta[currentEditingProvider]; // Renaming
    }
    
    tablaOferta[newName] = newActivities;
    saveAndRefresh();
    alert("Proveedor guardado exitosamente.");
    
    manageProviderSelect.value = newName;
    currentEditingProvider = newName;
    btnDeleteProvider.classList.remove('hidden');
});

btnDeleteProvider.addEventListener('click', () => {
    if (currentEditingProvider && confirm(`¿Seguro que deseas eliminar a ${currentEditingProvider}?`)) {
        delete tablaOferta[currentEditingProvider];
        saveAndRefresh();
        manageProviderSelect.value = '';
        providerEditor.classList.add('hidden');
    }
});

function saveAndRefresh() {
    localStorage.setItem('calcPago_tablaOferta', JSON.stringify(tablaOferta));
    updateInitialProviderSelect();
    updateManageProviderSelect();
    calculateAndRenderSummary(); // re-calculate if current OT is loaded
}

function updateManageProviderSelect() {
    const select = document.getElementById('manage-provider-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>';
    Object.keys(tablaOferta).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });
    if(tablaOferta[currentVal]) select.value = currentVal;
}

// Functions
function setupDragAndDrop(dropZone, inputElement, handler) {
    if(!dropZone || !inputElement) return;
    dropZone.addEventListener('click', () => inputElement.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove('dragover');
        });
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handler(e.dataTransfer.files[0]);
        }
    });

    inputElement.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handler(e.target.files[0]);
            e.target.value = ''; // Reset for re-uploading modified files with same name
        }
    });
}

// 1. Parse Tabla Oferta
function handleOfertaUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (json.length < 2) {
                alert("El archivo parece estar vacío o no tiene el formato correcto.");
                return;
            }

            let headerRowIndex = -1;
            let headers = [];
            let descIndex = -1;
            
            for (let i = 0; i < json.length; i++) {
                if (json[i]) {
                    const rowStrs = json[i].map(c => c ? c.toString().toUpperCase().trim() : '');
                    const foundDesc = rowStrs.indexOf('DESCRIPCION');
                    if (foundDesc !== -1) {
                        headerRowIndex = i;
                        headers = rowStrs;
                        descIndex = foundDesc;
                        break;
                    }
                }
            }

            if (headerRowIndex === -1) {
                alert("No se encontró la columna 'DESCRIPCION' en el archivo.");
                return;
            }

            const parsedData = {};
            const providerCols = {};
            
            // Los proveedores son todas las columnas DESPUÉS de DESCRIPCION
            for(let i = descIndex + 1; i < headers.length; i++) {
                let headerVal = headers[i];
                if(headerVal && headerVal !== 'NA' && headerVal !== 'N/A' && headerVal.length > 1) {
                    headerVal = normalizeProviderName(headerVal);
                    if (!parsedData[headerVal]) {
                        parsedData[headerVal] = {};
                    }
                    providerCols[i] = headerVal;
                }
            }

            for (let r = headerRowIndex + 1; r < json.length; r++) {
                const row = json[r];
                if (!row) continue;
                
                // La actividad es el valor en la columna descIndex
                let actividad = row[descIndex];
                actividad = actividad ? actividad.toString().trim() : '';
                if (!actividad) continue;

                for(const colIndex in providerCols) {
                    const provider = providerCols[colIndex];
                    const val = row[colIndex];
                    if (val !== undefined && val !== null) {
                        let price = 0;
                        if (typeof val === 'number') {
                            price = val;
                        } else {
                            // Limpiar C$, comas y símbolos raros en caso de que lo hayan digitado como texto
                            let priceStr = val.toString().replace(/,/g, '').replace(/[^0-9.-]+/g,"");
                            price = parseFloat(priceStr);
                        }
                        if (!isNaN(price)) {
                            parsedData[provider][actividad] = price;
                        }
                    }
                }
            }

            Object.keys(parsedData).forEach(p => {
                if (Object.keys(parsedData[p]).length === 0) {
                    delete parsedData[p];
                }
            });

            // En lugar de reemplazar completamente, fusionamos los datos (Merge)
            // Esto permite mantener los proveedores o actividades previas.
            Object.keys(parsedData).forEach(provider => {
                const normProvider = normalizeProviderName(provider);
                if (!tablaOferta[normProvider]) {
                    tablaOferta[normProvider] = {};
                }
                Object.keys(parsedData[provider]).forEach(act => {
                    tablaOferta[normProvider][act] = parsedData[provider][act];
                });
            });
            consolidateEnergyProvider();
            saveAndRefresh();
            
            // Visual success indicator
            const dropZoneOferta = document.getElementById('drop-zone-oferta');
            dropZoneOferta.innerHTML = '<div style="color: var(--accent); font-size: 3rem; margin-bottom: 1rem;">✓</div><p>¡Tabla procesada con éxito!</p>';
            
            setTimeout(() => {
                // Switch to Manage tab to show the results
                document.querySelector('.tab-btn[data-target="tab-manage"]').click();
                
                // Select the first provider to show its data
                const firstProvider = Object.keys(parsedData)[0] || Object.keys(tablaOferta)[0];
                if (firstProvider) {
                    const manageSelect = document.getElementById('manage-provider-select');
                    manageSelect.value = firstProvider;
                    manageSelect.dispatchEvent(new Event('change'));
                }
                
                // Reset dropzone text
                dropZoneOferta.innerHTML = '<p>Arrastra el archivo aquí o haz clic</p><input type="file" id="input-oferta" accept=".xlsx, .xls" hidden>';
                setupDragAndDrop(dropZoneOferta, document.getElementById('input-oferta'), handleOfertaUpload);
            }, 1500);

        } catch (err) {
            console.error(err);
            alert("Error al procesar el archivo Excel: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// 2. Parse Estado de OT
function handleOTUpload(file) {
    if (Object.keys(tablaOferta).length === 0) {
        alert("Por favor configura la Tabla de Oferta primero.");
        setupOverlay.classList.remove('hidden');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === 'OT');
            if (!sheetName) {
                alert("No se encontró la hoja 'OT' en el archivo.");
                return;
            }

            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const extracted = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                const providerRaw = row[31] ? normalizeProviderName(row[31].toString()) : '';
                
                if (providerRaw) {
                    const ordenStr = row[2] ? row[2].toString().trim() : 'N/A';
                    // Saltar la fila de encabezados si se coló
                    if (ordenStr.toUpperCase() === 'NO. OT/MR' || ordenStr.toUpperCase() === 'ORDEN' || ordenStr.toUpperCase() === 'ORDEN DE TRABAJO') {
                        continue;
                    }
                    let fechaRaw = row[32];
                    let fechaStr = 'N/A';
                    let fechaObj = new Date(8640000000000000); // Max date so it goes to bottom if unknown
                    if (typeof fechaRaw === 'number') {
                        // Convertir número de serie de Excel a fecha JS
                        fechaObj = new Date(Math.round((fechaRaw - 25569) * 86400 * 1000));
                        // Asegurarnos de que no haya desajustes por zona horaria
                        const d = fechaObj.getUTCDate();
                        const m = fechaObj.getUTCMonth() + 1;
                        const y = fechaObj.getUTCFullYear();
                        fechaStr = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
                    } else if (fechaRaw) {
                        fechaStr = fechaRaw.toString().trim();
                        // Try to parse string DD/MM/YYYY
                        const parts = fechaStr.split('/');
                        if(parts.length === 3) {
                            fechaObj = new Date(parts[2], parts[1]-1, parts[0]);
                        }
                    }

                    const fileNameUpper = file.name.toUpperCase();
                    const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
                    let fileMonth = 'NO DEFINIDO';
                    months.forEach(m => { if (fileNameUpper.includes(m)) fileMonth = m; });

                    extracted.push({
                        id: Date.now() + i, // Unique ID
                        orden: ordenStr,
                        fecha: fechaStr,
                        fechaObj: fechaObj,
                        actividad: row[9] ? row[9].toString().trim() : 'Sin Especificar',
                        proveedor: providerRaw,
                        semana: null,
                        mes: fileMonth,
                        fileName: file.name
                    });
                }
            }

            if (extracted.length === 0) {
                alert("No se encontraron actividades en el archivo de OT.");
                return;
            }

            // Si se vuelve a subir un archivo del mismo mes o del mismo nombre,
            // reemplazamos los registros automáticos anteriores de ese mes/archivo
            const fileMonthDetected = extracted[0] ? extracted[0].mes : 'NO DEFINIDO';
            let replacedCount = 0;
            const beforeCount = currentOTData.length;

            if (fileMonthDetected !== 'NO DEFINIDO') {
                currentOTData = currentOTData.filter(item => item.isManual || item.mes !== fileMonthDetected);
            } else {
                currentOTData = currentOTData.filter(item => item.isManual || item.fileName !== file.name);
            }
            replacedCount = beforeCount - currentOTData.length;

            currentOTData = currentOTData.concat(extracted);
            currentOTData.sort((a, b) => a.fechaObj - b.fechaObj);
            
            updateMonthFilter();
            
            // Si hay un proveedor seleccionado, mantenemos ese, si no, se queda en ALL
            const initialProviderSelect = document.getElementById('initial-provider-select');
            selectedProvider = initialProviderSelect.value || 'ALL';
            
            renderTable();
            calculateAndRenderSummary();
            updateProviderPricesTable();
            saveWorkspaceState();

            if (replacedCount > 0) {
                alert(`¡Estado de OT actualizado con éxito!\nSe reemplazaron ${replacedCount} registros anteriores del mes (${fileMonthDetected}) con la versión más reciente del archivo.`);
            } else {
                alert(`¡Se cargaron ${extracted.length} órdenes de trabajo (${fileMonthDetected}) con éxito!`);
            }
            
        } catch (err) {
            console.error(err);
            alert("Error al procesar el Estado de OT: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Botón de Refrescar Datos
document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    currentOTData.sort((a, b) => a.fechaObj - b.fechaObj);
    renderTable();
    calculateAndRenderSummary();
    updateProviderPricesTable();
    alert("¡Vista y datos refrescados con éxito!");
});

// 3. UI Renders
function updateInitialProviderSelect() {
    const select = document.getElementById('initial-provider-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    Object.keys(tablaOferta).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });
    if(tablaOferta[currentVal]) select.value = currentVal;
}



// Update initial provider select change listener to update table
document.getElementById('initial-provider-select').addEventListener('change', (e) => {
    selectedProvider = e.target.value;
    renderTable();
    calculateAndRenderSummary();
    updateProviderPricesTable();
});

// Search functionality sync
const searchTopInput = document.getElementById('search-ot');
const searchTableInput = document.getElementById('table-search-ot');
const btnTableSearch = document.getElementById('btn-table-search');

function triggerSearchSync(val) {
    if (searchTopInput && searchTopInput.value !== val) searchTopInput.value = val;
    if (searchTableInput && searchTableInput.value !== val) searchTableInput.value = val;
    renderTable();
    calculateAndRenderSummary();
}

searchTopInput?.addEventListener('input', (e) => triggerSearchSync(e.target.value));
searchTableInput?.addEventListener('input', (e) => triggerSearchSync(e.target.value));
btnTableSearch?.addEventListener('click', () => {
    const val = searchTableInput?.value || searchTopInput?.value || '';
    triggerSearchSync(val);
});

function updateProviderPricesTable() {
    const tableBody = document.getElementById('provider-prices-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (!selectedProvider || selectedProvider === 'ALL' || !tablaOferta[selectedProvider]) {
        tableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">Seleccione un proveedor para ver sus precios.</td></tr>';
        return;
    }
    
    const activities = tablaOferta[selectedProvider];
    const keys = Object.keys(activities);
    
    if (keys.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">El proveedor no tiene actividades.</td></tr>';
        return;
    }
    
    keys.forEach(act => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${act}</td>
            <td style="text-align:right; font-weight:600; color:var(--accent);">C$${activities[act].toFixed(2)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderTable() {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    
    if(currentOTData.length === 0) {
        tableBody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay datos. Selecciona un proveedor y carga un Estado de OT.</td></tr>';
        return;
    }

    const searchTerm = (document.getElementById('table-search-ot')?.value || document.getElementById('search-ot')?.value || '').trim().toLowerCase();
    const selectedMonth = document.getElementById('month-filter')?.value || 'ALL';

    const filteredData = currentOTData.filter(d => {
        if (selectedMonth !== 'ALL' && d.mes !== selectedMonth) return false;
        if (searchTerm !== '') {
            return d.orden.toLowerCase().includes(searchTerm);
        }
        return selectedProvider === 'ALL' || d.proveedor === selectedProvider;
    });

    if(filteredData.length === 0) {
        tableBody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay resultados.</td></tr>';
        return;
    }

    // Ordenar OTs por número de orden de menor a mayor
    filteredData.sort((a, b) => a.orden.localeCompare(b.orden, undefined, { numeric: true, sensitivity: 'base' }));

    filteredData.forEach(item => {
        const tr = document.createElement('tr');
        if (item.semana) {
            tr.classList.add(`row-sem${item.semana}`);
            tr.classList.add('row-validated');
        }

        const provPrices = tablaOferta[item.proveedor];
        const priceInfo = findProviderPrice(item.actividad, provPrices);
        let activityHTML = '';

        if (priceInfo.price === 0) {
            activityHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; flex-wrap: wrap;">
                    <span style="font-weight: 500;">${item.actividad}</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span class="badge-zero-price btn-trigger-edit-act" data-id="${item.id}" title="⚠️ C$0.00: No se encontró tarifa en la oferta. Haz clic para asociar o corregir la descripción.">⚠️ C$0.00 (Sin Tarifa)</span>
                        <button class="btn-edit-act btn-trigger-edit-act" data-id="${item.id}" title="Editar o asociar descripción">✏️</button>
                    </div>
                </div>
            `;
        } else {
            activityHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                    <span>${item.actividad}</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 0.75rem; color: #00A859; font-weight: 600; background: rgba(0, 168, 89, 0.08); padding: 1px 6px; border-radius: 6px;">C$${priceInfo.price.toFixed(2)}</span>
                        <button class="btn-edit-act btn-trigger-edit-act" data-id="${item.id}" title="Editar o corregir descripción">✏️</button>
                    </div>
                </div>
            `;
        }

        tr.innerHTML = `
            <td>${item.orden}</td>
            <td>${item.fecha}</td>
            <td>${activityHTML}</td>
            <td>${item.proveedor}</td>
            <td><input type="checkbox" class="week-checkbox" data-id="${item.id}" data-sem="1" ${item.semana === 1 ? 'checked' : ''}></td>
            <td><input type="checkbox" class="week-checkbox" data-id="${item.id}" data-sem="2" ${item.semana === 2 ? 'checked' : ''}></td>
            <td><input type="checkbox" class="week-checkbox" data-id="${item.id}" data-sem="3" ${item.semana === 3 ? 'checked' : ''}></td>
            <td><input type="checkbox" class="week-checkbox" data-id="${item.id}" data-sem="4" ${item.semana === 4 ? 'checked' : ''}></td>
        `;
        tableBody.appendChild(tr);
    });

    const checkboxes = document.querySelectorAll('.week-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', handleCheckboxChange);
    });

    const editBtns = document.querySelectorAll('.btn-trigger-edit-act');
    editBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            openEditActivityModal(id);
        });
    });
}

function handleCheckboxChange(e) {
    const cb = e.target;
    const id = parseInt(cb.getAttribute('data-id'));
    const sem = parseInt(cb.getAttribute('data-sem'));
    const isChecked = cb.checked;

    const item = currentOTData.find(d => d.id === id);
    if (!item) return;

    if (isChecked) {
        if (item.semana !== null && item.semana !== sem) {
            const confirmMove = confirm(`⚠️ ALERTA DE POSIBLE PAGO DOBLE ⚠️\n\nEsta actividad ya estaba asignada a la Semana ${item.semana}.\nSi la Semana ${item.semana} ya fue pagada, moverla a la Semana ${sem} ocasionará un doble pago al proveedor.\n\n¿Estás seguro de que esto fue un error de digitación y deseas MOVERLA a la Semana ${sem}?`);
            if (!confirmMove) {
                cb.checked = false;
                return;
            }
            if (item.actividad.toUpperCase().includes('RECLAMO')) {
                if (providerDeductions[selectedProvider] && providerDeductions[selectedProvider][item.semana]) {
                    providerDeductions[selectedProvider][item.semana] = providerDeductions[selectedProvider][item.semana].filter(d => d.linkedId !== item.id);
                }
            }
        }

        if (item.actividad.toUpperCase().includes('RECLAMO') && item.semana !== sem) {
            const monto = prompt(`La OT ${item.orden} es un RECLAMO.\n¿Cuánto deseas descontar al proveedor? (Ingresa el monto o deja en 0 si no aplica descuento)`, "0");
            const amt = parseFloat(monto);
            if (!isNaN(amt) && amt > 0) {
                if (!providerDeductions[selectedProvider]) providerDeductions[selectedProvider] = {1:[], 2:[], 3:[], 4:[]};
                providerDeductions[selectedProvider][sem].push({
                    name: `OT ${item.orden} - Reclamo`,
                    amount: amt,
                    linkedId: item.id
                });
            }
        }
        item.semana = sem;
    } else {
        const confirmUncheck = confirm(`⚠️ ALERTA ⚠️\n\nEstás retirando la validación de la Semana ${item.semana}.\nSi esta semana ya fue cobrada por el proveedor, quitarla alterará tu historial.\n\n¿Deseas removerla (ej. por error de digitación)?`);
        if (!confirmUncheck) {
            cb.checked = true;
            return;
        }

        if (item.actividad.toUpperCase().includes('RECLAMO')) {
            if (providerDeductions[selectedProvider] && providerDeductions[selectedProvider][item.semana]) {
                 providerDeductions[selectedProvider][item.semana] = providerDeductions[selectedProvider][item.semana].filter(d => d.linkedId !== item.id);
            }
        }
        item.semana = null;
    }

    renderTable(); // Re-render everything to move the row visually
    calculateAndRenderSummary();
    saveWorkspaceState();
}

// Normalización de Abreviaturas y Términos Frecuentes
function normalizeActivityTerms(actStr) {
    if (!actStr) return '';
    let s = actStr.toUpperCase().trim();
    // Reemplazo de abreviaturas habituales en OT
    s = s.replace(/\bMANTO\.?\b/g, 'MANTENIMIENTO');
    s = s.replace(/\bMANTE\.?\b/g, 'MANTENIMIENTO');
    s = s.replace(/\bA\/A\b/g, 'AIRE ACONDICIONADO');
    s = s.replace(/\bA\.A\.\b/g, 'AIRE ACONDICIONADO');
    s = s.replace(/\bAA\b/g, 'AIRE ACONDICIONADO');
    s = s.replace(/\bA\/C\b/g, 'AIRE ACONDICIONADO');
    s = s.replace(/\bAC\b/g, 'AIRE ACONDICIONADO');
    s = s.replace(/\bDIAG\.?\b/g, 'DIAGNOSTICO');
    s = s.replace(/\bREP\.?\b/g, 'REPARACION');
    s = s.replace(/\bREPAR\.?\b/g, 'REPARACION');
    s = s.replace(/\bINST\.?\b/g, 'INSTALACION');
    s = s.replace(/\bDESINST\.?\b/g, 'DESINSTALACION');
    s = s.replace(/\bPREV\.?\b/g, 'PREVENTIVO');
    s = s.replace(/\bCORRECT\.?\b/g, 'CORRECTIVO');
    return s;
}

// Function for 'Homologación de Términos'
function findProviderPrice(actividadStr, providerPrices) {
    if (!providerPrices || !actividadStr) return { price: 0, mappedName: actividadStr || 'Sin Especificar' };
    
    const providerKeys = Object.keys(providerPrices);
    if (providerKeys.length === 0) return { price: 0, mappedName: actividadStr };

    // 1. Exact match on raw string
    if (providerPrices[actividadStr] !== undefined) {
        return { price: providerPrices[actividadStr], mappedName: actividadStr };
    }

    const normAct = normalizeActivityTerms(actividadStr);

    // 2. Exact match on normalized string vs provider offer keys
    const exactNormKey = providerKeys.find(k => k.toUpperCase() === normAct || normalizeActivityTerms(k) === normAct);
    if (exactNormKey) {
        return { price: providerPrices[exactNormKey], mappedName: exactNormKey };
    }
    
    // 3. Custom Business Rules (Homologación de Términos Avanzada)
    let bestKey = null;

    if (normAct.includes('MANTENIMIENTO') && normAct.includes('AIRE ACONDICIONADO')) {
        bestKey = providerKeys.find(k => {
            const kn = normalizeActivityTerms(k);
            return kn.includes('MANTENIMIENTO') && (kn.includes('AIRE ACONDICIONADO') || kn.includes('AA'));
        }) || providerKeys.find(k => k.toUpperCase().includes('MANTENIMIENTO'));
    }

    if (!bestKey && normAct.includes('VISITA')) {
        if (normAct.includes('WHATSAPP') || normAct.includes('WHAT SAP')) {
            bestKey = providerKeys.find(k => k.toUpperCase().includes('WHATSAPP') || k.toUpperCase().includes('WHAT SAP'));
        } else {
            bestKey = providerKeys.find(k => k.toUpperCase().includes('VISITA A DOMICILIO') || k.toUpperCase() === 'VISITA');
        }
    }

    if (!bestKey && normAct.includes('DIAGNOSTICO')) {
        bestKey = providerKeys.find(k => {
            const ku = k.toUpperCase();
            return ku.includes('VISITA A DOMICILIO') || ku.includes('VISITA') || ku.includes('DIAGNOSTICO');
        });
    }
    
    if (!bestKey && normAct.includes('DESINSTALACION')) {
        bestKey = providerKeys.find(k => k.toUpperCase().includes('DESINSTALACION'));
    }
    
    if (!bestKey && normAct.includes('INSTALACION')) {
        bestKey = providerKeys.find(k => k.toUpperCase().includes('INSTALACION'));
    }
    
    if (!bestKey && normAct.includes('PUNTO ELECTRICO')) {
        bestKey = providerKeys.find(k => k.toUpperCase().includes('PUNTO ELECTRICO'));
    }

    if (!bestKey && normAct.includes('REPARACION')) {
        bestKey = providerKeys.find(k => k.toUpperCase().includes('REPARACION'));
    }

    if (bestKey) {
        return { price: providerPrices[bestKey], mappedName: bestKey };
    }

    // 4. Fallback partial match (normalized strings)
    const keyMatch = providerKeys.find(k => {
        const kn = normalizeActivityTerms(k);
        return normAct.includes(kn) || kn.includes(normAct);
    });
    if (keyMatch) {
        return { price: providerPrices[keyMatch], mappedName: keyMatch };
    }
    
    return { price: 0, mappedName: actividadStr };
}

function calculateAndRenderSummary() {
    summaryCards.innerHTML = '';
    
    let totals = {
        sem1: 0,
        sem2: 0,
        sem3: 0,
        sem4: 0,
        total: 0
    };

    const selectedMonth = document.getElementById('month-filter')?.value || 'ALL';

    // Para el Consolidado de Pago por Semana NO filtramos por mes NI por término de búsqueda.
    // Lo asignado a una semana de pago se mantiene siempre visible en el consolidado general.
    const consolidatedData = currentOTData.filter(d => {
        if (!d.semana) return false;
        return selectedProvider === 'ALL' || d.proveedor === selectedProvider;
    });

    let consolidatedByWeek = {
        1: { data: {}, total: 0, hasData: false },
        2: { data: {}, total: 0, hasData: false },
        3: { data: {}, total: 0, hasData: false },
        4: { data: {}, total: 0, hasData: false }
    };

    consolidatedData.forEach(item => {
        if (item.semana) {
            const providerPrices = tablaOferta[item.proveedor];
            const { price, mappedName } = findProviderPrice(item.actividad, providerPrices);
            
            totals[`sem${item.semana}`] += price;
            totals.total += price;

            const weekData = consolidatedByWeek[item.semana];
            weekData.hasData = true;
            if (!weekData.data[mappedName]) {
                weekData.data[mappedName] = { cantidad: 0, precioUnitario: price, total: 0 };
            }
            weekData.data[mappedName].cantidad += 1;
            weekData.data[mappedName].total += price;
            weekData.total += price;
        }
    });

    const container = document.getElementById('consolidated-weeks-container');
    if (container) {
        container.innerHTML = '';
        let generatedAny = false;

        for (let w = 1; w <= 4; w++) {
            const week = consolidatedByWeek[w];
            
            // Inyectar Extras en la data de la semana antes de renderizar
            if (!providerExtras[selectedProvider]) providerExtras[selectedProvider] = { 1: [], 2: [], 3: [], 4: [] };
            
            let weekExtras = [];
            if (Array.isArray(providerExtras[selectedProvider][w])) {
                weekExtras = providerExtras[selectedProvider][w];
            } else if (providerExtras[selectedProvider][selectedMonth] && Array.isArray(providerExtras[selectedProvider][selectedMonth][w])) {
                weekExtras = providerExtras[selectedProvider][selectedMonth][w];
            }
            
            if (weekExtras && weekExtras.length > 0) {
                week.hasData = true; // Forzar a que la semana se muestre si hay extras
                weekExtras.forEach(extra => {
                    const mappedName = extra.actividad.toUpperCase(); // Forzar mayúsculas para coincidir
                    if (!week.data[mappedName]) {
                        week.data[mappedName] = { cantidad: 0, precioUnitario: extra.valor, total: 0 };
                    }
                    week.data[mappedName].cantidad += 1;
                    week.data[mappedName].total += extra.valor;
                    week.total += extra.valor;
                    
                    totals[`sem${w}`] += extra.valor;
                    totals.total += extra.valor;
                });
            }

            if (week.hasData) {
                generatedAny = true;
                
                let tbodyHTML = '';
                Object.keys(week.data).forEach(act => {
                    const row = week.data[act];
                    const isZeroPrice = row.precioUnitario === 0;
                    if (isZeroPrice) {
                        tbodyHTML += `
                            <tr style="background-color: rgba(220, 38, 38, 0.06);">
                                <td style="color: var(--danger); font-weight: 600;">
                                    ${act}
                                    <span style="display: block; font-size: 0.72rem; font-weight: 700; color: #DC2626; margin-top: 2px;">
                                        ⚠️ Tarifa C$0.00 (No encontrada en oferta). Haz clic en ✏️ en la tabla superior para asociarla
                                    </span>
                                </td>
                                <td style="text-align:center; color: var(--danger); font-weight:bold;">${row.cantidad}</td>
                                <td style="text-align:right; color: var(--danger); font-weight:bold;">C$0.00</td>
                                <td style="text-align:right; font-weight:bold; color:var(--danger);">C$0.00</td>
                            </tr>
                        `;
                    } else {
                        tbodyHTML += `
                            <tr>
                                <td>${act}</td>
                                <td style="text-align:center;">${row.cantidad}</td>
                                <td style="text-align:right;">C$${row.precioUnitario.toFixed(2)}</td>
                                <td style="text-align:right; font-weight:600; color:var(--accent);">C$${row.total.toFixed(2)}</td>
                            </tr>
                        `;
                    }
                });

                let dedBodyHTML = '';
                let totalDeductions = 0;
                
                if (!providerDeductions[selectedProvider]) {
                    providerDeductions[selectedProvider] = { 1: [], 2: [], 3: [], 4: [] };
                }
                const weekDeds = providerDeductions[selectedProvider][w];
                
                if (weekDeds && weekDeds.length > 0) {
                    weekDeds.forEach((ded, idx) => {
                        totalDeductions += ded.amount;
                        dedBodyHTML += `
                            <tr style="background-color: rgba(220, 38, 38, 0.05);">
                                <td colspan="2" style="color: var(--danger);"><span style="font-size: 0.75rem; background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; margin-right: 8px;">Reclamo</span> ${ded.name}</td>
                                <td style="text-align:right;"></td>
                                <td style="text-align:right; font-weight:600; color:var(--danger);">-C$${ded.amount.toFixed(2)}
                                    <button class="btn-icon btn-remove-deduction" data-week="${w}" data-idx="${idx}" style="margin-left: 10px; color: var(--danger); padding: 0;" title="Eliminar deducción">✖</button>
                                </td>
                            </tr>
                        `;
                    });
                }
                
                let extrasListHTML = '';
                if (weekExtras && weekExtras.length > 0) {
                    extrasListHTML = `
                        <div style="padding: 0.5rem 1rem; background: rgba(16, 185, 129, 0.05); border-top: 1px solid var(--glass-border); font-size: 0.8rem;">
                            <strong style="color: #10B981; display: block; margin-bottom: 0.3rem;">Extras Añadidos en esta semana:</strong>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${weekExtras.map((extra, idx) => `
                                    <li style="display: flex; justify-content: space-between; margin-bottom: 0.2rem; align-items: center;">
                                        <span>[${extra.fecha}] Orden: ${extra.orden} - ${extra.actividad} (C$${extra.valor.toFixed(2)})</span>
                                        <button class="btn-icon btn-remove-extra" data-week="${w}" data-idx="${idx}" style="color: var(--danger); padding: 0 4px;" title="Eliminar extra">✖</button>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                }

                const finalTotal = week.total - totalDeductions;

                const wColor = {
                    1: '#3B82F6', // Azul
                    2: '#F59E0B', // Naranja
                    3: '#8B5CF6', // Púrpura
                    4: '#14B8A6'  // Teal
                }[w];

                if (!providerFacturas[selectedProvider]) providerFacturas[selectedProvider] = { 1: '', 2: '', 3: '', 4: '' };
                let currentFactura = '';
                if (typeof providerFacturas[selectedProvider][w] === 'string') {
                    currentFactura = providerFacturas[selectedProvider][w];
                } else if (providerFacturas[selectedProvider][selectedMonth] && providerFacturas[selectedProvider][selectedMonth][w]) {
                    currentFactura = providerFacturas[selectedProvider][selectedMonth][w];
                }

                const tableHTML = `
                    <div style="margin-bottom: 2rem; border: 1px solid ${wColor}80; border-radius: 8px; overflow: hidden; background: var(--bg-panel); box-shadow: 0 4px 6px -1px ${wColor}22;">
                        <div style="background: ${wColor}15; border-bottom: 1px solid ${wColor}40; padding: 0.8rem 1.2rem; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <h4 style="margin: 0; font-size: 1.1rem; color: ${wColor}; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Semana ${w}</h4>
                                <input type="text" class="custom-input invoice-input" data-week="${w}" placeholder="No. Factura" value="${currentFactura}" style="padding: 0.3rem 0.5rem; font-size: 0.85rem; width: 150px; border-color: ${wColor}40;" title="Factura del proveedor">
                            </div>
                            <button class="btn btn-primary btn-pdf-dynamic" data-week="${w}" style="background-color: ${wColor}; border-color: ${wColor}; color: white; padding: 0.4rem 0.8rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">📄 Descargar PDF</button>
                        </div>
                        <div class="table-scroll" style="max-height: none;">
                            <table class="data-table">
                               <thead>
                                    <tr>
                                        <th>Actividad</th>
                                        <th style="text-align:center;">Cantidad</th>
                                        <th style="text-align:right;">Valor Unitario</th>
                                        <th style="text-align:right;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tbodyHTML}
                                    ${dedBodyHTML}
                                </tbody>
                                <tfoot style="font-weight: 700; background: rgba(0,0,0,0.05);">
                                    <tr>
                                        <td colspan="3" style="text-align:right; color: ${wColor};">TOTAL A PAGAR SEMANA ${w}:</td>
                                        <td style="text-align:right; color: ${wColor}; font-size: 1.1rem;">C$${finalTotal.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        ${extrasListHTML}
                        <div style="padding: 1rem; background: rgba(0,0,0,0.02); display: flex; gap: 0.5rem; align-items: center; border-top: 1px solid var(--glass-border);">
                            <span style="font-size: 0.8rem; font-weight: bold; color: #10B981; width: 60px;">+ Extra:</span>
                            <input type="date" id="extra-date-${w}" class="custom-input" style="width: 110px; font-size: 0.85rem; padding: 0.4rem;" title="Fecha de ejecución">
                            <input type="text" id="extra-orden-${w}" placeholder="No. Orden" class="custom-input" style="width: 100px; font-size: 0.85rem; padding: 0.4rem;">
                            <input type="text" id="extra-name-${w}" placeholder="Actividad" class="custom-input" style="flex: 1; font-size: 0.85rem; padding: 0.4rem;">
                            <input type="number" id="extra-amount-${w}" placeholder="Monto (C$)" class="custom-input" style="width: 100px; font-size: 0.85rem; padding: 0.4rem;">
                            <button class="btn btn-outline btn-add-extra" data-week="${w}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; color: #10B981; border-color: #10B981;">Agregar</button>
                        </div>
                        <div style="padding: 1rem; padding-top: 0; background: rgba(0,0,0,0.02); display: flex; gap: 0.5rem; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: bold; color: var(--danger); width: 60px;">- Reclamo:</span>
                            <input type="text" id="deduction-name-${w}" placeholder="Motivo de deducción / Reclamo" class="custom-input" style="flex: 1; font-size: 0.85rem; padding: 0.4rem;">
                            <input type="number" id="deduction-amount-${w}" placeholder="Monto (C$)" class="custom-input" style="width: 100px; font-size: 0.85rem; padding: 0.4rem;">
                            <button class="btn btn-outline btn-add-deduction" data-week="${w}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; color: var(--danger); border-color: var(--danger);">Descontar</button>
                        </div>
                    </div>
                `;
                container.innerHTML += tableHTML;
            }
        }

        if (!generatedAny) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin: 2rem 0;">No hay actividades validadas. Seleccione actividades arriba para ver los consolidados.</p>';
        } else {
            document.querySelectorAll('.btn-pdf-dynamic').forEach(btn => {
                btn.addEventListener('click', handlePDFGeneration);
            });
            
            document.querySelectorAll('.btn-add-deduction').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const w = parseInt(e.target.getAttribute('data-week'));
                    const nameInput = document.getElementById(`deduction-name-${w}`);
                    const amountInput = document.getElementById(`deduction-amount-${w}`);
                    const name = nameInput.value.trim();
                    const amount = parseFloat(amountInput.value);
                    
                    if (name && !isNaN(amount) && amount > 0) {
                        if (!providerDeductions[selectedProvider]) providerDeductions[selectedProvider] = { 1: [], 2: [], 3: [], 4: [] };
                        providerDeductions[selectedProvider][w].push({ name, amount });
                        calculateAndRenderSummary();
                    } else {
                        alert("Por favor ingrese un motivo válido y un monto mayor a 0.");
                    }
                });
            });

            document.querySelectorAll('.btn-remove-deduction').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const w = parseInt(e.target.getAttribute('data-week'));
                    const idx = parseInt(e.target.getAttribute('data-idx'));
                    providerDeductions[selectedProvider][w].splice(idx, 1);
                    calculateAndRenderSummary();
                });
            });

            document.querySelectorAll('.btn-add-extra').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const w = parseInt(e.target.getAttribute('data-week'));
                    const dateInput = document.getElementById(`extra-date-${w}`);
                    const ordenInput = document.getElementById(`extra-orden-${w}`);
                    const nameInput = document.getElementById(`extra-name-${w}`);
                    const amountInput = document.getElementById(`extra-amount-${w}`);
                    
                    const fecha = dateInput.value;
                    const orden = ordenInput.value.trim();
                    const actividad = nameInput.value.trim();
                    const valor = parseFloat(amountInput.value);
                    
                    if (fecha && orden && actividad && !isNaN(valor) && valor > 0) {
                        if (!providerExtras[selectedProvider]) providerExtras[selectedProvider] = { 1: [], 2: [], 3: [], 4: [] };
                        if (!Array.isArray(providerExtras[selectedProvider][w])) providerExtras[selectedProvider][w] = [];
                        providerExtras[selectedProvider][w].push({ fecha, orden, actividad, valor });
                        calculateAndRenderSummary();
                    } else {
                        alert("Por favor complete Fecha, No. Orden, Actividad y un Valor mayor a 0.");
                    }
                });
            });

            document.querySelectorAll('.btn-remove-extra').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const w = parseInt(e.target.getAttribute('data-week'));
                    const idx = parseInt(e.target.getAttribute('data-idx'));
                    if (Array.isArray(providerExtras[selectedProvider][w])) {
                        providerExtras[selectedProvider][w].splice(idx, 1);
                    } else if (providerExtras[selectedProvider][selectedMonth] && Array.isArray(providerExtras[selectedProvider][selectedMonth][w])) {
                        providerExtras[selectedProvider][selectedMonth][w].splice(idx, 1);
                    }
                    calculateAndRenderSummary();
                });
            });

            document.querySelectorAll('.invoice-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const w = parseInt(e.target.getAttribute('data-week'));
                    if (!providerFacturas[selectedProvider]) providerFacturas[selectedProvider] = { 1: '', 2: '', 3: '', 4: '' };
                    providerFacturas[selectedProvider][w] = e.target.value;
                });
            });
        }
    }

    const createCard = (title, value, subtitle) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="card-title">${title}</div>
            <div class="card-value">C$${value.toFixed(2)}</div>
            <div class="card-subtitle">${subtitle}</div>
        `;
        return div;
    };

    summaryCards.appendChild(createCard('Total General', totals.total, 'Suma de todas las semanas validadas'));
    summaryCards.appendChild(createCard('Semana 1', totals.sem1, 'Corte Semana 1'));
    summaryCards.appendChild(createCard('Semana 2', totals.sem2, 'Corte Semana 2'));
    summaryCards.appendChild(createCard('Semana 3', totals.sem3, 'Corte Semana 3'));
    summaryCards.appendChild(createCard('Semana 4', totals.sem4, 'Corte Semana 4'));
}

// -- Calculator Logic --
const calcCurrent = document.getElementById('calc-current');
const calcHistory = document.getElementById('calc-history');
const calcButtons = document.querySelectorAll('.calc-btn');

let calcState = {
    current: '0',
    previous: null,
    operator: null,
    historyStr: ''
};

function updateCalcDisplay() {
    calcCurrent.textContent = calcState.current;
    calcHistory.textContent = calcState.historyStr;
}

calcButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const content = btn.textContent;

        if (!action || btn.classList.contains('number')) {
            // It's a number
            if (content === '.' && calcState.current.includes('.')) return;
            if (calcState.current === '0' && content !== '.') {
                calcState.current = content;
            } else {
                calcState.current += content;
            }
            updateCalcDisplay();
        } else if (action === 'clear') {
            calcState = { current: '0', previous: null, operator: null, historyStr: '' };
            updateCalcDisplay();
        } else if (action === 'delete') {
            if (calcState.current.length > 1) {
                calcState.current = calcState.current.slice(0, -1);
            } else {
                calcState.current = '0';
            }
            updateCalcDisplay();
        } else if (action === 'percent') {
            calcState.current = String(parseFloat(calcState.current) / 100);
            updateCalcDisplay();
        } else if (['add', 'subtract', 'multiply', 'divide'].includes(action)) {
            calcState.operator = action;
            calcState.previous = calcState.current;
            calcState.current = '0';
            calcState.historyStr = `${calcState.previous} ${getOpSymbol(calcState.operator)}`;
            updateCalcDisplay();
        } else if (action === 'calculate') {
            if (calcState.operator && calcState.previous) {
                const n1 = parseFloat(calcState.previous);
                const n2 = parseFloat(calcState.current);
                let result = 0;
                switch (calcState.operator) {
                    case 'add': result = n1 + n2; break;
                    case 'subtract': result = n1 - n2; break;
                    case 'multiply': result = n1 * n2; break;
                    case 'divide': result = n1 / n2; break;
                }
                calcState.historyStr = `${calcState.previous} ${getOpSymbol(calcState.operator)} ${calcState.current} =`;
                calcState.current = String(result);
                calcState.operator = null;
                calcState.previous = null;
                updateCalcDisplay();
            }
        }
    });
});

// -- Floating & Sticky Calculator Controls --
const calcEl = document.getElementById('calculator');
const btnPinCalc = document.getElementById('btn-pin-calc');
const btnToggleFloatCalc = document.getElementById('btn-toggle-float-calc');
const calcHeader = document.getElementById('calc-header');

function setCalculatorFloatingMode(isFloating) {
    if (!calcEl) return;
    if (isFloating) {
        calcEl.classList.add('calculator-floating');
        if (btnPinCalc) btnPinCalc.textContent = '📍 Fijar';
        if (btnToggleFloatCalc) btnToggleFloatCalc.style.background = '#047857';
        localStorage.setItem('calcPago_calcFloating', 'true');
    } else {
        calcEl.classList.remove('calculator-floating');
        calcEl.style.top = '';
        calcEl.style.left = '';
        calcEl.style.bottom = '';
        calcEl.style.right = '';
        if (btnPinCalc) btnPinCalc.textContent = '📌 Flotante';
        if (btnToggleFloatCalc) btnToggleFloatCalc.style.background = '';
        localStorage.setItem('calcPago_calcFloating', 'false');
    }
}

btnPinCalc?.addEventListener('click', () => {
    const isFloating = calcEl.classList.contains('calculator-floating');
    setCalculatorFloatingMode(!isFloating);
});

btnToggleFloatCalc?.addEventListener('click', () => {
    const isFloating = calcEl.classList.contains('calculator-floating');
    setCalculatorFloatingMode(!isFloating);
});

// Restore preference if set
if (localStorage.getItem('calcPago_calcFloating') === 'true') {
    setCalculatorFloatingMode(true);
}

// Make floating calculator draggable by header
if (calcHeader && calcEl) {
    calcHeader.onmousedown = (e) => {
        if (!calcEl.classList.contains('calculator-floating')) return;
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        let pos3 = e.clientX;
        let pos4 = e.clientY;
        document.onmouseup = () => {
            document.onmouseup = null;
            document.onmousemove = null;
        };
        document.onmousemove = (e) => {
            e.preventDefault();
            let pos1 = pos3 - e.clientX;
            let pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            calcEl.style.top = (calcEl.offsetTop - pos2) + "px";
            calcEl.style.left = (calcEl.offsetLeft - pos1) + "px";
            calcEl.style.bottom = "auto";
            calcEl.style.right = "auto";
        };
    };
}

function getOpSymbol(op) {
    switch(op) {
        case 'add': return '+';
        case 'subtract': return '-';
        case 'multiply': return '×';
        case 'divide': return '÷';
    }
    return '';
}

// Auto-Guardado en memoria del navegador (localStorage)
function saveWorkspaceState() {
    try {
        const state = {
            version: 4,
            currentOTData,
            providerDeductions,
            providerFacturas,
            providerExtras,
            selectedProvider,
            tablaOferta
        };
        localStorage.setItem('calcPago_workspaceState', JSON.stringify(state));
    } catch (e) {
        console.warn("No se pudo auto-guardar la sesión en localStorage:", e);
    }
}

// -- Save / Load Progress --
document.getElementById('btn-save-progress')?.addEventListener('click', async () => {
    if (currentOTData.length === 0) {
        alert("No hay datos ni órdenes de trabajo cargadas para guardar.");
        return;
    }

    const saveState = {};
    let savedCount = 0;
    currentOTData.forEach(item => {
        if (item.semana !== null) {
            const key = `${item.orden}_${item.mes}`;
            saveState[key] = item.semana;
            savedCount++;
        }
    });

    const saveObj = {
        version: 4,
        appName: "CalcPago",
        savedAt: new Date().toISOString(),
        selectedProvider: selectedProvider,
        validations: saveState,
        otData: currentOTData, // Arreglo completo de OTs (subidas por Excel + creadas manualmente)
        deductions: providerDeductions,
        extras: providerExtras,
        facturas: providerFacturas,
        tablaOferta: tablaOferta
    };
    
    const jsonString = JSON.stringify(saveObj, null, 2);
    const providerTag = selectedProvider && selectedProvider !== 'ALL' ? selectedProvider.replace(/\s+/g, '_') : 'General';
    const defaultName = `CalcPago_Consolidado_${providerTag}_${new Date().toLocaleDateString('es-NI').replace(/\//g, '')}.json`;

    try {
        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{
                    description: 'Archivo JSON CalcPago',
                    accept: {'application/json': ['.json']},
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            alert("¡Consolidado completo guardado exitosamente!");
        } else {
            const filename = prompt("Introduce un nombre para este archivo de guardado:", defaultName.replace('.json', ''));
            if (!filename) return;

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `${filename}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error al guardar:", err);
            alert("Error al guardar el archivo: " + err.message);
        }
    }
});

document.getElementById('input-load-progress')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const saveObj = JSON.parse(event.target.result);
            
            // 1. Restaurar tabla de oferta si venía en el JSON
            if (saveObj.tablaOferta && Object.keys(saveObj.tablaOferta).length > 0) {
                tablaOferta = saveObj.tablaOferta;
                localStorage.setItem('calcPago_tablaOferta', JSON.stringify(tablaOferta));
                updateInitialProviderSelect();
                updateManageProviderSelect();
            }

            // 2. Restaurar OTs (incluye importadas y manuales)
            if (saveObj.version >= 4 && Array.isArray(saveObj.otData) && saveObj.otData.length > 0) {
                currentOTData = saveObj.otData.map(d => ({
                    ...d,
                    fechaObj: d.fechaObj ? new Date(d.fechaObj) : new Date()
                }));
            }

            // 3. Restaurar Deducciones, Extras y Facturas
            if (saveObj.deductions) providerDeductions = saveObj.deductions;
            if (saveObj.extras) providerExtras = saveObj.extras;
            if (saveObj.facturas) providerFacturas = saveObj.facturas;

            // 4. Restaurar proveedor seleccionado si venía en el JSON
            if (saveObj.selectedProvider) {
                selectedProvider = saveObj.selectedProvider;
                const initialSelect = document.getElementById('initial-provider-select');
                if (initialSelect && (selectedProvider === 'ALL' || tablaOferta[selectedProvider])) {
                    initialSelect.value = selectedProvider;
                }
            }

            // 5. Aplicar o fusionar validaciones si venían de versiones previas (v1-v3)
            let saveState = saveObj.validations || saveObj;
            if (saveObj.version < 4 && currentOTData.length > 0 && saveState) {
                currentOTData.forEach(item => {
                    if (selectedProvider === 'ALL' || item.proveedor === selectedProvider) {
                        const key = `${item.orden}_${item.mes}`;
                        if (saveState[key] !== undefined) {
                            item.semana = saveState[key];
                        } else if (saveState[item.orden] !== undefined) {
                            item.semana = saveState[item.orden];
                        }
                    }
                });
            }

            updateMonthFilter();
            renderTable();
            calculateAndRenderSummary();
            updateProviderPricesTable();
            saveWorkspaceState();

            alert(`¡Consolidado cargado exitosamente!\nSe restauraron ${currentOTData.length} órdenes de trabajo con todos sus consolidados, facturas y extras.`);
        } catch (err) {
            console.error(err);
            alert("Error al leer el archivo de guardado. Asegúrate de que sea el archivo .json correcto.");
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});


// -- PDF Generation --
function handlePDFGeneration(e) {
    const weekStr = e.target.getAttribute('data-week');
    const targetWeek = parseInt(weekStr);
    
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("Librería PDF no cargada aún. Por favor espera un segundo y vuelve a intentar.");
        return;
    }
    
    if (!selectedProvider || selectedProvider === 'ALL') {
        alert("Por favor, selecciona un proveedor específico para generar el reporte.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'letter');
    
    const verdeSINSA = [42, 143, 58]; // #2A8F3A
    const naranjaSINSA = [245, 130, 32]; // #F58220
    const grisOscuro = [74, 85, 104]; // #4A5568
    
    const reportDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Header
    doc.setTextColor(verdeSINSA[0], verdeSINSA[1], verdeSINSA[2]);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`REPORTE VALIDACIÓN - SEMANA ${targetWeek}`, 40, 50);
    
    doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Proveedor: ${selectedProvider}`, 40, 75);
    doc.text(`Fecha de Emisión: ${reportDate}`, 40, 95);

    const selectedMonth = document.getElementById('month-filter')?.value || 'ALL';
    
    let invoiceNum = 'N/A';
    if (providerFacturas[selectedProvider]) {
        if (typeof providerFacturas[selectedProvider][targetWeek] === 'string' && providerFacturas[selectedProvider][targetWeek]) {
            invoiceNum = providerFacturas[selectedProvider][targetWeek];
        } else if (providerFacturas[selectedProvider][selectedMonth] && providerFacturas[selectedProvider][selectedMonth][targetWeek]) {
            invoiceNum = providerFacturas[selectedProvider][selectedMonth][targetWeek];
        }
    }
    
    doc.setFont("helvetica", "bold");
    doc.text(`Factura / Referencia: ${invoiceNum}`, 40, 115);
    doc.setFont("helvetica", "normal");
    
    const filteredData = currentOTData.filter(d => d.proveedor === selectedProvider);
    const validatedActivities = filteredData.filter(d => d.semana === targetWeek);
    
    if(validatedActivities.length === 0) {
        alert(`No hay actividades validadas para la Semana ${targetWeek} de este proveedor.`);
        return;
    }
    
    // Detalle de OTs
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Detalle de Actividades - Semana ${targetWeek}`, 40, 130);
    
    const detailData = validatedActivities.map(item => [
        item.orden,
        item.fecha,
        item.actividad,
        `Semana ${item.semana}`
    ]);
    
    // Agregamos los extras al detalle también
    let totalExtras = 0;
    let weekExtrasForPDF = [];
    if (providerExtras[selectedProvider]) {
        if (Array.isArray(providerExtras[selectedProvider][targetWeek])) {
            weekExtrasForPDF = providerExtras[selectedProvider][targetWeek];
        } else if (providerExtras[selectedProvider][selectedMonth] && Array.isArray(providerExtras[selectedProvider][selectedMonth][targetWeek])) {
            weekExtrasForPDF = providerExtras[selectedProvider][selectedMonth][targetWeek];
        }
    }
    
    if (weekExtrasForPDF && weekExtrasForPDF.length > 0) {
        weekExtrasForPDF.forEach(extra => {
            detailData.push([
                `[EXTRA] ${extra.orden}`,
                extra.fecha || '-',
                extra.actividad,
                `Semana ${targetWeek}`
            ]);
            totalExtras += extra.valor;
        });
    }
    
    doc.autoTable({
        startY: 145,
        head: [['Orden de Trabajo', 'Fecha Ejecución', 'Actividad', 'Semana']],
        body: detailData,
        headStyles: { fillColor: verdeSINSA },
        styles: { textColor: grisOscuro, fontSize: 9 },
        alternateRowStyles: { fillColor: [237, 242, 247] } // Gris Claro #EDF2F7
    });
    
    // Consolidado Data
    let consolidatedData = {};
    let grandTotal = 0;
    
    validatedActivities.forEach(item => {
        const providerPrices = tablaOferta[item.proveedor];
        const { price, mappedName } = findProviderPrice(item.actividad, providerPrices);
        
        if (!consolidatedData[mappedName]) {
            consolidatedData[mappedName] = {
                cantidad: 0,
                precioUnitario: price,
                total: 0
            };
        }
        consolidatedData[mappedName].cantidad += 1;
        consolidatedData[mappedName].total += price;
        grandTotal += price;
    });
    
    // Agrupamos los extras directamente en el Consolidado para que se fusionen con las regulares
    if (weekExtrasForPDF && weekExtrasForPDF.length > 0) {
        weekExtrasForPDF.forEach(extra => {
            const mappedName = extra.actividad.toUpperCase();
            if (!consolidatedData[mappedName]) {
                consolidatedData[mappedName] = {
                    cantidad: 0,
                    precioUnitario: extra.valor,
                    total: 0
                };
            }
            consolidatedData[mappedName].cantidad += 1;
            consolidatedData[mappedName].total += extra.valor;
            grandTotal += extra.valor;
        });
    }
    
    const consBody = Object.keys(consolidatedData).map(act => [
        act,
        consolidatedData[act].cantidad.toString(),
        `C$${consolidatedData[act].precioUnitario.toFixed(2)}`,
        `C$${consolidatedData[act].total.toFixed(2)}`
    ]);
    
    // Add deductions to PDF
    let totalDeductions = 0;
    if (providerDeductions[selectedProvider] && providerDeductions[selectedProvider][targetWeek]) {
        const weekDeds = providerDeductions[selectedProvider][targetWeek];
        weekDeds.forEach(ded => {
            // Support multi-month deduction filtering
            if (ded.linkedId && selectedMonth !== 'ALL') {
                const linkedItem = currentOTData.find(d => d.id === ded.linkedId);
                if (linkedItem && linkedItem.mes !== selectedMonth) return;
            }
            totalDeductions += ded.amount;
            consBody.push([
                `[RECLAMO / DESCUENTO] ${ded.name}`,
                '-',
                '-',
                `-C$${ded.amount.toFixed(2)}`
            ]);
        });
    }
    
    const finalTotal = grandTotal - totalDeductions;
    
    let finalY = doc.lastAutoTable.finalY || 145;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Consolidado de Pagos - Semana ${targetWeek}`, 40, finalY + 30);
    
    doc.autoTable({
        startY: finalY + 40,
        head: [['Actividad', 'Cantidad', 'Valor Unitario', 'Total']],
        body: consBody,
        headStyles: { fillColor: naranjaSINSA },
        foot: [['', '', 'TOTAL A PAGAR:', `C$${finalTotal.toFixed(2)}`]],
        footStyles: { fillColor: verdeSINSA, textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { textColor: grisOscuro, fontSize: 10 },
        columnStyles: { 
            1: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' }
        }
    });
    
    // Control y Auditoría: Órdenes Autorizadas para Pago
    const paidOTList = [];
    validatedActivities.forEach(item => {
        if (item.orden) paidOTList.push(item.orden);
    });
    if (providerExtras[selectedProvider] && providerExtras[selectedProvider][selectedMonth] && providerExtras[selectedProvider][selectedMonth][targetWeek]) {
        const weekExtras = providerExtras[selectedProvider][selectedMonth][targetWeek];
        weekExtras.forEach(extra => {
            if (extra.orden) paidOTList.push(`${extra.orden} (Extra)`);
        });
    }

    finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : finalY) + 20;

    if (finalY > doc.internal.pageSize.height - 180) {
        doc.addPage();
        finalY = 40;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(verdeSINSA[0], verdeSINSA[1], verdeSINSA[2]);
    doc.text(`CONTROL Y AUDITORÍA: ÓRDENES AUTORIZADAS PARA PAGO (${paidOTList.length} OT${paidOTList.length !== 1 ? 's' : ''})`, 40, finalY);

    const otTextString = paidOTList.length > 0 ? paidOTList.join(', ') : 'Ninguna';
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(grisOscuro[0], grisOscuro[1], grisOscuro[2]);

    const splitOTs = doc.splitTextToSize(`Órdenes liquidadas: ${otTextString}`, doc.internal.pageSize.width - 90);
    const boxHeight = Math.max(32, splitOTs.length * 12 + 16);

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, finalY + 8, doc.internal.pageSize.width - 80, boxHeight, 4, 4, 'FD');

    doc.text(splitOTs, 50, finalY + 22);

    finalY += boxHeight + 20;

    // Signatures
    if (finalY > doc.internal.pageSize.height - 100) {
        doc.addPage();
        finalY = 50;
    }

    doc.setDrawColor(74, 85, 104);
    doc.line(80, finalY + 40, 250, finalY + 40);
    doc.setFontSize(11);
    doc.text("MAESTROS DE SINSA", 100, finalY + 55);

    doc.line(360, finalY + 40, 530, finalY + 40);
    doc.text(`PROVEEDOR: ${selectedProvider}`, 360, finalY + 55);

    doc.save(`Reporte_Validacion_${selectedProvider}_Semana_${targetWeek}.pdf`);
}

// -- Theme Toggle --
const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (btnThemeToggle) {
    const savedTheme = localStorage.getItem('calcPago_theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    btnThemeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('calcPago_theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('calcPago_theme', 'dark');
        }
    });
}

// -- Clear Data Logic --
document.getElementById('btn-clear-data')?.addEventListener('click', () => {
    if(confirm("¿Seguro que deseas limpiar TODOS los datos del Estado de OT y empezar de cero?\n(Tendrás que volver a subir el archivo Excel)")) {
        currentOTData = [];
        providerDeductions = {};
        const inputOTElement = document.getElementById('input-ot');
        if (inputOTElement) inputOTElement.value = '';
    }
});

// -- v2.0 Features --

function updateMonthFilter() {
    const select = document.getElementById('month-filter');
    if (!select) return;
    
    // Get unique months from currentOTData
    const months = [...new Set(currentOTData.map(d => d.mes))];
    const currentVal = select.value;
    
    select.innerHTML = '<option value="ALL">Todos los Meses</option>';
    months.forEach(m => {
        if(m) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            select.appendChild(opt);
        }
    });
    
    if(months.includes(currentVal)) select.value = currentVal;
}

document.getElementById('month-filter')?.addEventListener('change', () => {
    renderTable();
    calculateAndRenderSummary();
});

// Print Logic
document.getElementById('btn-print')?.addEventListener('click', () => {
    window.print();
});

// Manual Activity Overlay Logic
const manualOverlay = document.getElementById('manual-activity-overlay');
const manualProvider = document.getElementById('manual-provider');
const manualActivity = document.getElementById('manual-activity');

document.getElementById('btn-add-activity')?.addEventListener('click', () => {
    if(Object.keys(tablaOferta).length === 0) {
        alert("Configura la Tabla de Oferta primero.");
        return;
    }
    
    // Populate providers
    manualProvider.innerHTML = '<option value="">-- Seleccionar --</option>';
    Object.keys(tablaOferta).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        manualProvider.appendChild(opt);
    });
    
    if(selectedProvider !== 'ALL') {
        manualProvider.value = selectedProvider;
        manualProvider.dispatchEvent(new Event('change'));
    }
    
    manualOverlay.classList.remove('hidden');
});

document.getElementById('close-manual')?.addEventListener('click', () => {
    manualOverlay.classList.add('hidden');
});

manualProvider?.addEventListener('change', (e) => {
    const prov = e.target.value;
    manualActivity.innerHTML = '';
    if(prov && tablaOferta[prov]) {
        Object.keys(tablaOferta[prov]).forEach(act => {
            const opt = document.createElement('option');
            opt.value = act;
            opt.textContent = act;
            manualActivity.appendChild(opt);
        });
    }
});

document.getElementById('save-manual')?.addEventListener('click', () => {
    const prov = manualProvider.value;
    const act = manualActivity.value;
    const order = document.getElementById('manual-order').value.trim() || 'MANUAL-' + Date.now().toString().slice(-4);
    const sem = parseInt(document.getElementById('manual-week').value);
    const month = document.getElementById('manual-month').value;
    
    if(!prov || !act) {
        alert("Selecciona un proveedor y una actividad.");
        return;
    }
    
    const newItem = {
        id: Date.now(),
        orden: order,
        fecha: 'N/A (Manual)',
        fechaObj: new Date(),
        actividad: act,
        proveedor: prov,
        semana: sem,
        mes: month
    };
    
    currentOTData.push(newItem);
    
    updateMonthFilter();
    document.getElementById('month-filter').value = month; // switch to the month we just added
    
    if(selectedProvider === 'ALL' || selectedProvider === prov) {
        renderTable();
        calculateAndRenderSummary();
    }
    
    saveWorkspaceState();
    manualOverlay.classList.add('hidden');
    document.getElementById('manual-order').value = '';
});

document.getElementById('btn-clear-validations')?.addEventListener('click', () => {
    if(confirm("¿Seguro que deseas limpiar solo las VALIDACIONES (semanas marcadas y reclamos)?\n(El listado del Estado de OT se mantendrá para que puedas usarlo de nuevo)")) {
        if(currentOTData.length > 0) {
            currentOTData.forEach(item => item.semana = null);
        }
        providerDeductions = {};
        providerExtras = {};
        providerFacturas = {};
        renderTable();
        calculateAndRenderSummary();
        saveWorkspaceState();
    }
});

// -- Overlay/Modal de Edición y Homologación de Actividades --
let currentEditingOTId = null;

function openEditActivityModal(otId) {
    const item = currentOTData.find(d => d.id === otId);
    if (!item) return;
    currentEditingOTId = otId;

    const modal = document.getElementById('edit-activity-overlay');
    const orderInput = document.getElementById('edit-ot-order');
    const selectOffer = document.getElementById('edit-ot-select-offer');
    const textInput = document.getElementById('edit-ot-activity-text');

    if (!modal || !orderInput || !selectOffer || !textInput) return;

    orderInput.value = item.orden;
    textInput.value = item.actividad;

    // Poblar dropdown con actividades de la oferta del proveedor
    selectOffer.innerHTML = '<option value="">-- Seleccionar de la oferta del proveedor --</option>';
    const provPrices = tablaOferta[item.proveedor];
    if (provPrices) {
        Object.keys(provPrices).forEach(act => {
            const opt = document.createElement('option');
            opt.value = act;
            opt.textContent = `${act} (C$${provPrices[act].toFixed(2)})`;
            if (act.toUpperCase() === item.actividad.toUpperCase()) {
                opt.selected = true;
            }
            selectOffer.appendChild(opt);
        });
    }

    selectOffer.onchange = (e) => {
        if (e.target.value) {
            textInput.value = e.target.value;
        }
    };

    modal.classList.remove('hidden');
}

document.getElementById('close-edit-activity')?.addEventListener('click', () => {
    document.getElementById('edit-activity-overlay')?.classList.add('hidden');
});

document.getElementById('save-edit-activity')?.addEventListener('click', () => {
    if (!currentEditingOTId) return;
    const item = currentOTData.find(d => d.id === currentEditingOTId);
    if (!item) return;

    const newActivity = document.getElementById('edit-ot-activity-text').value.trim();
    if (!newActivity) {
        alert("Por favor ingresa o selecciona una descripción para la actividad.");
        return;
    }

    item.actividad = newActivity;
    document.getElementById('edit-activity-overlay')?.classList.add('hidden');

    renderTable();
    calculateAndRenderSummary();
    updateProviderPricesTable();
    saveWorkspaceState();

    const priceInfo = findProviderPrice(newActivity, tablaOferta[item.proveedor]);
    if (priceInfo.price > 0) {
        alert(`¡Actividad actualizada a "${newActivity}"!\nAsociada con tarifa C$${priceInfo.price.toFixed(2)} (${priceInfo.mappedName}).`);
    } else {
        alert(`¡Actividad actualizada a "${newActivity}"!\nNota: Aún no se encontró una tarifa exacta en la oferta del proveedor (${item.proveedor}).`);
    }
});

/* ==========================================================================
   MÓDULO DE VINCULACIÓN DE PROVEEDORES & FORMALIZACIÓN DE CONTRATOS (SINSA)
   ========================================================================== */

let proveedoresRegistrados = [];
let currentWizardStep = 1;
let wizardDocuments = {};
let wizardTarifas = [];
let wizardContratoRubricado = null;
let isRestoringDraft = false;
let autosaveTimer = null;
const STORAGE_KEY_WIZARD_DRAFT = 'calcPago_activeWizardDraft';
const STORAGE_KEY_PROVIDERS = 'calcPago_proveedoresRegistrados';

// Utilidades del Módulo de Proveedores
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function safeSaveProvidersLocally(providers) {
    try {
        localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(providers));
    } catch (e) {
        console.warn("Límite de cuota de localStorage alcanzado. Almacenando versión sin binarios pesados en local:", e);
        try {
            const lightList = providers.map(p => {
                if (p.contrato_rubricado && p.contrato_rubricado.dataUrl && p.contrato_rubricado.dataUrl.length > 50000) {
                    const clone = { ...p, contrato_rubricado: { ...p.contrato_rubricado } };
                    delete clone.contrato_rubricado.dataUrl;
                    clone.contrato_rubricado.hasStoredData = true;
                    return clone;
                }
                return p;
            });
            localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(lightList));
        } catch (err2) {
            console.error("Error al guardar respaldo ligero en localStorage:", err2);
        }
    }
}

function viewOrDownloadRubricatedFile(fileRecord) {
    if (!fileRecord || !fileRecord.dataUrl) {
        alert("⚠️ No se encontró el archivo digital del contrato rubricado en el registro.");
        return;
    }
    const a = document.createElement('a');
    a.href = fileRecord.dataUrl;
    a.download = fileRecord.fileName || 'Contrato_Rubricado_SINSA.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
    }, 200);
}

// Calcular Porcentaje de Avance del Proveedor (0 - 100%)
function calculateOnboardingProgress(data) {
    if (!data) return 0;
    let score = 0;

    // 1. Datos Generales (Máximo 40%)
    if (data.nombre_comercial && data.nombre_comercial.trim()) score += 8;
    if (data.nombre_representante && data.nombre_representante.trim()) score += 6;
    if (data.cedula && data.cedula.trim()) score += 6;
    if (data.ruc && data.ruc.trim()) score += 4;
    if ((data.telefono && data.telefono.trim()) || (data.correo && data.correo.trim())) score += 4;
    if (data.direccion && data.direccion.trim()) score += 4;
    if (data.cuenta_bancaria && data.cuenta_bancaria.trim()) score += 8;

    // 2. Expediente Documental (Máximo 35%)
    const reg = data.regimen || "Régimen de Cuota Fija";
    const reqDocs = DOCS_BY_REGIMEN[reg] || DOCS_BY_REGIMEN["Régimen de Cuota Fija"];
    const totalReq = reqDocs ? reqDocs.length : 8;
    const docs = data.documentos || {};
    let validatedDocs = 0;
    if (reqDocs) {
        reqDocs.forEach(d => {
            if (docs[d.id] && (docs[d.id].validated || docs[d.id].notRequired)) {
                validatedDocs++;
            }
        });
    }
    if (totalReq > 0) {
        score += Math.round((validatedDocs / totalReq) * 35);
    }

    // 3. Tarifario (Máximo 25%)
    const tarifas = data.tarifas || [];
    if (tarifas.length >= 5) {
        score += 25;
    } else if (tarifas.length > 0) {
        score += Math.round((tarifas.length / 5) * 25);
    }

    return Math.min(100, Math.max(0, score));
}

// Disparar autoguardado en segundo plano con debounce
function triggerWizardAutosave() {
    if (isRestoringDraft) return;

    const ind = document.getElementById('wizard-autosave-indicator');
    const txt = document.getElementById('wizard-autosave-text');
    if (ind && txt) {
        ind.classList.remove('saved');
        txt.textContent = 'Guardando borrador...';
    }

    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        saveActiveDraftToStorage();
    }, 350);
}

// Guardar borrador activo en localStorage
function saveActiveDraftToStorage() {
    const data = getWizardData();
    const hasAnyData = (data.nombre_comercial && data.nombre_comercial.trim()) ||
                       (data.nombre_representante && data.nombre_representante.trim()) ||
                       (data.cedula && data.cedula.trim()) ||
                       (data.telefono && data.telefono.trim()) ||
                       (data.cuenta_bancaria && data.cuenta_bancaria.trim()) ||
                       (data.tarifas && data.tarifas.length > 0) ||
                       (data.documentos && Object.keys(data.documentos).length > 0);

    const ind = document.getElementById('wizard-autosave-indicator');
    const txt = document.getElementById('wizard-autosave-text');

    if (!hasAnyData) {
        if (ind && txt) {
            ind.classList.remove('saved');
            txt.textContent = 'Formulario limpio';
        }
        return;
    }

    const prog = calculateOnboardingProgress(data);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const draft = {
        ...data,
        estado: 'BORRADOR',
        paso_actual: currentWizardStep,
        progreso: prog,
        updatedAt: now.toISOString(),
        updatedTimeStr: timeStr
    };

    localStorage.setItem(STORAGE_KEY_WIZARD_DRAFT, JSON.stringify(draft));

    if (ind && txt) {
        ind.classList.add('saved');
        txt.textContent = `Borrador autoguardado (${timeStr})`;
    }

    // Actualizar banner si existe
    const banner = document.getElementById('wizard-draft-banner');
    const title = document.getElementById('draft-banner-title');
    const desc = document.getElementById('draft-banner-desc');
    if (banner && title && desc) {
        const provName = draft.nombre_comercial || draft.nombre_representante || 'Contratista en proceso';
        title.textContent = `📝 Registro en curso: "${provName}" (${prog}% completado)`;
        desc.textContent = `Última edición: Hoy a las ${timeStr}. Los campos llenados se conservan automáticamente.`;
        banner.classList.remove('hidden');
    }
}

// Verificar y mostrar borrador activo si existe
function checkActiveWizardDraft() {
    const banner = document.getElementById('wizard-draft-banner');
    const title = document.getElementById('draft-banner-title');
    const desc = document.getElementById('draft-banner-desc');

    const draftJson = localStorage.getItem(STORAGE_KEY_WIZARD_DRAFT);
    if (!draftJson) {
        if (banner) banner.classList.add('hidden');
        return;
    }

    try {
        const draft = JSON.parse(draftJson);
        const name = draft.nombre_comercial || draft.nombre_representante || 'Contratista en proceso';
        const prog = draft.progreso !== undefined ? draft.progreso : calculateOnboardingProgress(draft);

        if (banner && title && desc) {
            title.textContent = `📝 Tienes un registro en curso: "${name}" (${prog}% completado)`;
            desc.textContent = `Última edición: ${draft.updatedTimeStr || 'Reciente'}. Puedes continuar llenando los datos pendientes o guardar este borrador.`;
            banner.classList.remove('hidden');
        }

        // Si el formulario actual está vacío pero hay un borrador activo, restaurarlo automáticamente
        const currentName = document.getElementById('wiz-nombre-comercial')?.value.trim();
        if (!currentName && (draft.nombre_comercial || draft.nombre_representante || (draft.tarifas && draft.tarifas.length > 0))) {
            loadDraftIntoForm(draft, draft.paso_actual || 1);
        }
    } catch (e) {
        console.error("Error al restaurar borrador activo:", e);
    }
}

// Cargar un borrador en el formulario del asistente
function loadDraftIntoForm(draft, targetStep = null) {
    if (!draft) return;
    isRestoringDraft = true;

    if (draft.regimen) {
        const regEl = document.getElementById('wiz-regimen');
        if (regEl) regEl.value = draft.regimen;
    }
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
    };

    setVal('wiz-nombre-comercial', draft.nombre_comercial || '');
    setVal('wiz-nombre-rep', draft.nombre_representante || '');
    setVal('wiz-cedula', draft.cedula || '');
    setVal('wiz-ruc', draft.ruc || '');
    setVal('wiz-matricula', draft.matricula || '');
    setVal('wiz-estado-civil', draft.estado_civil || 'casado');
    setVal('wiz-profesion', draft.profesion || '');
    setVal('wiz-domicilio', draft.domicilio || 'Managua');
    setVal('wiz-telefono', draft.telefono || '');
    setVal('wiz-correo', draft.correo || '');
    setVal('wiz-direccion', draft.direccion || '');
    setVal('wiz-banco', draft.banco || 'BAC Credomatic');
    setVal('wiz-cuenta', draft.cuenta_bancaria || '');
    setVal('wiz-titular', draft.titular_cuenta || '');
    setVal('wiz-inss', draft.inss || '');
    setVal('wiz-fuel-rate', draft.tarifa_combustible !== undefined ? draft.tarifa_combustible : 12.0);
    setVal('contract-day', draft.dia !== undefined ? draft.dia : 23);
    setVal('contract-month', draft.mes || 'octubre');

    wizardDocuments = draft.documentos ? JSON.parse(JSON.stringify(draft.documentos)) : {};
    wizardTarifas = draft.tarifas ? JSON.parse(JSON.stringify(draft.tarifas)) : [];
    wizardContratoRubricado = draft.contrato_rubricado ? JSON.parse(JSON.stringify(draft.contrato_rubricado)) : null;

    renderWizardDocs();
    renderWizardTariffTable();
    renderWizardRubricationSection();

    isRestoringDraft = false;

    const stepToGo = targetStep || draft.paso_actual || 1;
    goToWizardStep(stepToGo);

    const ind = document.getElementById('wizard-autosave-indicator');
    const txt = document.getElementById('wizard-autosave-text');
    if (ind && txt) {
        ind.classList.add('saved');
        txt.textContent = `Borrador cargado (${draft.updatedTimeStr || 'OK'})`;
    }
}

// Guardar explícitamente el asistente como borrador en el directorio
async function saveCurrentWizardAsDraft(goToDirectory = true) {
    const data = getWizardData();
    let name = data.nombre_comercial.trim();

    if (!name) {
        name = prompt("Para guardar este borrador, por favor ingresa un Nombre Comercial o Alias para identificar al contratista:", data.nombre_representante || "Contratista Pendiente");
        if (!name || !name.trim()) {
            alert("⚠️ No se puede guardar el borrador sin un nombre o alias identificador.");
            return;
        }
        document.getElementById('wiz-nombre-comercial').value = name.trim();
        data.nombre_comercial = name.trim();
    }

    const prog = calculateOnboardingProgress(data);
    const draftRecord = {
        ...data,
        estado: 'BORRADOR',
        progreso: prog,
        paso_actual: currentWizardStep,
        fecha_modificacion: new Date().toLocaleString()
    };

    // Guardar o actualizar en proveedoresRegistrados
    const idx = proveedoresRegistrados.findIndex(p => 
        (p.nombre_comercial || p.nombre || '').trim().toUpperCase() === name.toUpperCase()
    );
    if (idx >= 0) {
        proveedoresRegistrados[idx] = draftRecord;
    } else {
        proveedoresRegistrados.push(draftRecord);
    }

    safeSaveProvidersLocally(proveedoresRegistrados);

    // Intentar sincronizar con backend
    try {
        await fetch('/api/save-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftRecord)
        });
    } catch (e) {
        console.log("Guardado local completado.");
    }

    // Actualizar también el borrador activo en curso
    localStorage.setItem(STORAGE_KEY_WIZARD_DRAFT, JSON.stringify({
        ...draftRecord,
        updatedAt: new Date().toISOString(),
        updatedTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    alert(`💾 ¡Borrador de "${name}" guardado exitosamente!\n\nAvance: ${prog}% completado.\nTodos los campos llenados, tarifas y documentos se encuentran resguardados. Podrás continuar el registro en cualquier momento desde el "Directorio de Proveedores".`);

    if (goToDirectory) {
        switchModuleView('view-directory');
        renderDirectory();
    } else {
        checkActiveWizardDraft();
    }
}

// Retomar un borrador desde el directorio de proveedores
function resumeProviderOnboarding(prov) {
    switchModuleView('view-onboarding');
    loadDraftIntoForm(prov, prov.paso_actual || 1);

    // Actualizar active draft
    localStorage.setItem(STORAGE_KEY_WIZARD_DRAFT, JSON.stringify({
        ...prov,
        updatedAt: new Date().toISOString(),
        updatedTimeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    checkActiveWizardDraft();
    window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Eliminar o descartar un borrador
async function deleteProviderDraft(provName) {
    if (!confirm(`¿Estás seguro de eliminar el borrador de "${provName}"?`)) {
        return;
    }

    proveedoresRegistrados = proveedoresRegistrados.filter(p => 
        (p.nombre_comercial || p.nombre || '').trim().toUpperCase() !== provName.trim().toUpperCase()
    );
    safeSaveProvidersLocally(proveedoresRegistrados);

    // Si coincide con el borrador activo, limpiarlo
    const activeDraftJson = localStorage.getItem(STORAGE_KEY_WIZARD_DRAFT);
    if (activeDraftJson) {
        try {
            const activeDraft = JSON.parse(activeDraftJson);
            if ((activeDraft.nombre_comercial || activeDraft.nombre || '').trim().toUpperCase() === provName.trim().toUpperCase()) {
                resetWizardForm();
            }
        } catch(e){}
    }

    // Sincronizar borrado con backend
    try {
        await fetch('/api/delete-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre_comercial: provName })
        });
    } catch(e){}

    renderDirectory();
}

const DOCS_BY_REGIMEN = {
    "Régimen de Cuota Fija": [
        { id: "formato_alta", name: "Formato de Solicitud de Alta", desc: "Firmado y sellado por el contratista (Procedimiento 10.P.S01.0001)" },
        { id: "cedula", name: "Cédula de Identidad Vigente", desc: "Copia legible de cédula nicaragüense vigente del titular" },
        { id: "ruc", name: "Cédula RUC Vigente", desc: "Constancia de RUC emitida por DGI en régimen de cuota fija" },
        { id: "matricula", name: "Matrícula de Alcaldía Vigente", desc: "Matrícula municipal del año en curso del municipio correspondiente" },
        { id: "factura", name: "Factura o Talonario en Blanco", desc: "Pie de imprenta autorizado por DGI con numeración y vigencia" },
        { id: "solvencia", name: "Solvencia Fiscal Actualizada", desc: "Certificación de solvencia tributaria vigente emitida por DGI" },
        { id: "etica", name: "Declaratoria de Ética y Conducta", desc: "Carta de aceptación firmada del Código de Ética de SINSA" },
        { id: "inss", name: "Constancia de Afiliación al INSS", desc: "Respaldo de seguro social del contratista o de sus trabajadores" }
    ],
    "Régimen General": [
        { id: "formato_alta", name: "Formato de Solicitud de Alta", desc: "Firmado y sellado por el Representante Legal" },
        { id: "cedula", name: "Cédula del Representante Legal", desc: "Cédula vigente del apoderado o representante legal" },
        { id: "ruc", name: "Cédula RUC Vigente", desc: "Cédula RUC vigente en Régimen General" },
        { id: "matricula", name: "Matrícula de Alcaldía Vigente", desc: "Matrícula municipal vigente de la empresa" },
        { id: "factura", name: "Factura de Venta en Blanco", desc: "Cumplimiento con requisitos de ventanilla (10.PO.S01.0006)" },
        { id: "constitucion", name: "Acta de Constitución y Estatutos", desc: "Testimonio de Escritura Pública inscrita en Registro Mercantil" },
        { id: "poder", name: "Poder Notarial del Representante", desc: "Poder General o Especial inscrito en el Registro Público" },
        { id: "constancia_dgi", name: "Constancia de Inscripción DGI", desc: "Inscripción en la Dirección General de Ingresos" },
        { id: "iva", name: "Constancia de Recaudador de IVA", desc: "Acreditación como responsable recaudador de IVA" },
        { id: "solvencia", name: "Solvencia Fiscal Actualizada", desc: "Solvencia fiscal vigente emitida por la DGI" },
        { id: "beneficiario", name: "Certificado de Beneficiario Final", desc: "Declaración y certificación de beneficiario final actualizada" },
        { id: "etica", name: "Declaratoria de Ética SINSA", desc: "Carta de adhesión y cumplimiento de código de conducta" },
        { id: "inss", name: "Constancia de Afiliación al INSS", desc: "Certificado patronal del INSS al día con sus contribuciones" }
    ],
    "Persona Natural No Inscrita en DGI": [
        { id: "formato_alta", name: "Formato de Solicitud de Alta", desc: "Firmado y con huella dactilar del prestador del servicio" },
        { id: "cedula", name: "Cédula de Identidad Vigente", desc: "Copia legible de cédula de identidad nacional" }
    ]
};

// Carga inicial de proveedores registrados
async function loadProveedoresRegistrados() {
    // 1. Intentar cargar desde localStorage
    const saved = localStorage.getItem('calcPago_proveedoresRegistrados');
    if (saved) {
        try {
            proveedoresRegistrados = JSON.parse(saved);
        } catch (e) {
            proveedoresRegistrados = [];
        }
    }

    // 2. Intentar sincronizar con el servidor local
    try {
        const res = await fetch('/api/providers');
        if (res.ok) {
            const serverList = await res.json();
            if (Array.isArray(serverList) && serverList.length > 0) {
                // Merge without duplicates
                serverList.forEach(sp => {
                    const normSp = normalizeProviderName(sp.nombre_comercial || sp.nombre || '');
                    const k = normSp.trim().toUpperCase();
                    if (!proveedoresRegistrados.some(p => normalizeProviderName(p.nombre_comercial || p.nombre || '').trim().toUpperCase() === k)) {
                        proveedoresRegistrados.push(sp);
                    }
                });
            }
        }
    } catch (err) {
        console.log("Modo offline o servidor local sin API de proveedores activa.");
    }

    // 2.5 Consolidar proveedor único oficial ENERGY SYSTEM
    // Limpiar cualquier variación previa de ENERGY o ENERGY SYSTEMS para asegurar una única ficha limpia
    proveedoresRegistrados = proveedoresRegistrados.filter(p => {
        const k = (p.nombre_comercial || p.nombre || '').trim().toUpperCase();
        return k !== 'ENERGY' && k !== 'ENERGY SYSTEMS' && k !== 'ENERGY SYSTEM';
    });

    const energyTarifas = [
        { rms: '101016766', descripcion: 'INSTALACION BASICA DE AIRE ACONDICIONADO 12K Y 18K BTU', tarifa: 1500 },
        { rms: '101016773', descripcion: 'INSTALACION BASICA DE AIRE ACONDICIONADO 24K BTU', tarifa: 1800 },
        { rms: '101016781', descripcion: 'DESINSTALACION DE AIRE ACONDICIONADO 12K Y 18K BTU', tarifa: 800 },
        { rms: '101016790', descripcion: 'DESINSTALACION DE AIRE ACONDICIONADO 24K BTU', tarifa: 900 },
        { rms: '101016802', descripcion: 'MANTENIMIENTO PREVENTIVO DE AIRE ACONDICIONADO 12K Y 18K BTU', tarifa: 700 },
        { rms: '101016810', descripcion: 'MANTENIMIENTO PREVENTIVO DE AIRE ACONDICIONADO 24K BTU', tarifa: 850 },
        { rms: '101026007', descripcion: 'INSTALACION BASICA DE A/C 12000 BTU INVERTER Y CONVENCIONAL', tarifa: 1500 },
        { rms: '101025389', descripcion: 'INSTALACION BASICA DE A/C 18000 BTU INVERTER Y CONVENCIONAL', tarifa: 1500 },
        { rms: '145518214', descripcion: 'INSTALACION BASICA DE A/C 24000 BTU INVERTER Y CONVENCIONAL', tarifa: 1800 },
        { rms: '130196460', descripcion: 'INSTALACION BASICA DE A/C 36000 BTU INVERTER Y CONVENCIONAL', tarifa: 2500 },
        { rms: '130196451', descripcion: 'DESINSTALACION DE A/C DE 12,000 Y 18,000 BTU', tarifa: 800 },
        { rms: '137301040', descripcion: 'DESINSTALACION DE A/C DE 24,000 Y 36,000 BTU', tarifa: 900 },
        { rms: '101026023', descripcion: 'MANTENIMIENTO PREVENTIVO DE A/C 12000 Y 18000 BTU', tarifa: 700 },
        { rms: '101026031', descripcion: 'MANTENIMIENTO PREVENTIVO DE A/C 24000 Y 36000 BTU', tarifa: 850 }
    ];

    const energyProv = {
        nombre_comercial: 'ENERGY SYSTEM',
        nombre_representante: 'JOSE ARMANDO VANEGAS SALAZAR',
        cedula: '001-090987-0043X',
        ruc: '0010909870043X',
        estado_civil: 'Soltero',
        profesion: 'Técnico Especialista en HVAC',
        domicilio: 'Managua, Nicaragua',
        regimen: 'Régimen General',
        banco: 'Banco LAFISE Bancentro',
        cuenta_bancaria: '102201948',
        titular_cuenta: 'JOSE ARMANDO VANEGAS SALAZAR',
        telefono: '8645-3129 / 8856-1234',
        correo: 'energy.systems.ni@gmail.com',
        direccion: 'Reparto San Antonio, de la Iglesia San Antonio 2 c al sur, 1 c al este, casa #D-12, Managua',
        tarifa_combustible: 12.0,
        tarifas: energyTarifas,
        contrato_rubricado: {
            fileName: 'CONTRADO ENERGY FIRMADO (2).pdf',
            fileSize: '3.8 MB',
            uploadDate: '23/09/2026',
            observaciones: 'Contrato formal rubricado y legalizado por SILVA INTERNACIONAL S.A. y ENERGY SYSTEM'
        },
        documentos: {
            cedula: { fileName: 'Cedula_Jose_Armando_Vanegas.pdf', validated: true, notRequired: false },
            ruc: { fileName: 'RUC_Energy_Systems.pdf', validated: true, notRequired: false },
            matricula: { fileName: 'Matricula_Alcaldia_Managua_2026.pdf', validated: true, notRequired: false },
            solvencia_fiscal: { fileName: 'Solvencia_Fiscal_DGI_Vigente.pdf', validated: true, notRequired: false },
            poder_legal: { notRequired: true, justification: 'Persona natural con negocio / Titular directo' },
            certificacion_bancaria: { fileName: 'Certificacion_Cuenta_LAFISE.pdf', validated: true, notRequired: false },
            antecedentes: { fileName: 'Record_Policia_Vanegas.pdf', validated: true, notRequired: false },
            certificacion_tecnica: { fileName: 'Certificacion_Tecnica_Refrigeracion.pdf', validated: true, notRequired: false },
            seguro_inss: { fileName: 'Constancia_Cumplimiento_INSS.pdf', validated: true, notRequired: false }
        }
    };
    proveedoresRegistrados.unshift(energyProv);

    // Sincronizar también con tablaOferta para el motor de cálculo
    if (!tablaOferta['ENERGY SYSTEM']) {
        tablaOferta['ENERGY SYSTEM'] = {};
    }
    energyTarifas.forEach(t => {
        tablaOferta['ENERGY SYSTEM'][t.descripcion] = t.tarifa;
    });
    delete tablaOferta['ENERGY'];
    delete tablaOferta['ENERGY SYSTEMS'];
    setupEnergyAliases();
    localStorage.setItem('calcPago_tablaOferta', JSON.stringify(tablaOferta));

    // 3. Si tablaOferta tiene proveedores que no están en el directorio, agregarlos como base
    Object.keys(tablaOferta).forEach(rawPName => {
        const pName = normalizeProviderName(rawPName);
        const k = pName.trim().toUpperCase();
        if (!proveedoresRegistrados.some(p => normalizeProviderName(p.nombre_comercial || p.nombre || '').trim().toUpperCase() === k)) {
            const acts = tablaOferta[pName] || tablaOferta[rawPName] || {};
            const actList = Object.keys(acts).map(a => ({
                rms: a.includes('101') || a.includes('130') || a.includes('145') || a.includes('137') ? a.substring(0, 9).trim() : '',
                descripcion: a,
                tarifa: acts[a]
            }));
            proveedoresRegistrados.push({
                nombre_comercial: pName,
                nombre_representante: pName,
                cedula: 'En trámite',
                ruc: '',
                regimen: 'Régimen de Cuota Fija',
                banco: 'BAC Credomatic',
                cuenta_bancaria: '',
                titular_cuenta: pName,
                telefono: '8888-0000',
                correo: 'contacto@proveedor.com',
                direccion: 'Managua, Nicaragua',
                tarifa_combustible: 12.0,
                tarifas: actList,
                documentos: {}
            });
        }
    });

    localStorage.setItem('calcPago_proveedoresRegistrados', JSON.stringify(proveedoresRegistrados));
    renderDirectory();
}

// Inicialización de Eventos del Módulo
document.addEventListener('DOMContentLoaded', () => {
    initNavigationTabs();
    initOnboardingWizard();
    initDirectoryModule();
    loadProveedoresRegistrados();
    checkActiveWizardDraft();
});

// Navegación entre Módulos
function initNavigationTabs() {
    const navTabs = document.querySelectorAll('#main-nav .nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetView = tab.getAttribute('data-view');
            switchModuleView(targetView);
        });
    });
}

function switchModuleView(targetViewId) {
    // Actualizar tabs
    document.querySelectorAll('#main-nav .nav-tab').forEach(t => {
        if (t.getAttribute('data-view') === targetViewId) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    // Ocultar todas las vistas
    const dashboardView = document.getElementById('dashboard');
    const onboardingView = document.getElementById('view-onboarding');
    const directoryView = document.getElementById('view-directory');

    if (dashboardView) dashboardView.classList.add('hidden');
    if (onboardingView) onboardingView.classList.add('hidden');
    if (directoryView) directoryView.classList.add('hidden');

    // Mostrar vista destino
    if (targetViewId === 'dashboard' && dashboardView) {
        dashboardView.classList.remove('hidden');
        calculateAndRenderSummary();
    } else if (targetViewId === 'view-onboarding' && onboardingView) {
        onboardingView.classList.remove('hidden');
        checkActiveWizardDraft();
    } else if (targetViewId === 'view-directory' && directoryView) {
        directoryView.classList.remove('hidden');
        renderDirectory();
    }
}

// Inicialización del Asistente de Vinculación (Wizard)
function initOnboardingWizard() {
    // Stepper header clicks: permite navegar libremente entre pasos sin perder datos
    document.querySelectorAll('.stepper-bar .step-item').forEach(item => {
        item.addEventListener('click', () => {
            const stepNum = parseInt(item.getAttribute('data-step'), 10);
            triggerWizardAutosave();
            goToWizardStep(stepNum);
        });
    });

    // Step navigation buttons
    document.getElementById('btn-wiz-next-1')?.addEventListener('click', () => {
        let nomComercial = document.getElementById('wiz-nombre-comercial')?.value.trim();
        const nomRep = document.getElementById('wiz-nombre-rep')?.value.trim();
        const titularInput = document.getElementById('wiz-titular');

        // Si falta el nombre comercial, solicitar al menos un alias para identificar el contratista
        if (!nomComercial) {
            nomComercial = prompt("Para identificar este registro, por favor ingresa el Nombre Comercial o un Alias para el contratista:", nomRep || "");
            if (nomComercial && nomComercial.trim()) {
                document.getElementById('wiz-nombre-comercial').value = nomComercial.trim();
            } else {
                alert("Por favor ingresa al menos un nombre o alias para continuar.");
                document.getElementById('wiz-nombre-comercial')?.focus();
                return;
            }
        }

        // Auto-asignar titular de cuenta si está vacío
        if (titularInput && !titularInput.value.trim() && nomRep) {
            titularInput.value = nomRep;
        }

        triggerWizardAutosave();
        goToWizardStep(2);
    });

    document.getElementById('btn-wiz-prev-2')?.addEventListener('click', () => {
        triggerWizardAutosave();
        goToWizardStep(1);
    });

    document.getElementById('btn-wiz-next-2')?.addEventListener('click', () => {
        triggerWizardAutosave();
        goToWizardStep(3);
    });

    document.getElementById('btn-wiz-prev-3')?.addEventListener('click', () => {
        triggerWizardAutosave();
        goToWizardStep(2);
    });

    document.getElementById('btn-wiz-next-3')?.addEventListener('click', () => {
        triggerWizardAutosave();
        goToWizardStep(4);
    });

    document.getElementById('btn-wiz-prev-4')?.addEventListener('click', () => {
        triggerWizardAutosave();
        goToWizardStep(3);
    });

    // Evento de cambio de régimen en Paso 1
    document.getElementById('wiz-regimen')?.addEventListener('change', () => {
        renderWizardDocs();
        triggerWizardAutosave();
    });

    // Botón para exonerar todos los recaudos pendientes en Paso 2
    document.getElementById('btn-exempt-remaining-docs')?.addEventListener('click', () => {
        const regimen = document.getElementById('wiz-regimen')?.value || "Régimen de Cuota Fija";
        const reqDocs = DOCS_BY_REGIMEN[regimen] || DOCS_BY_REGIMEN["Régimen de Cuota Fija"];
        if (!reqDocs) return;

        let modified = 0;
        reqDocs.forEach(doc => {
            const cur = wizardDocuments[doc.id];
            const isAlreadyValid = cur && cur.validated && cur.fileName;
            if (!isAlreadyValid) {
                wizardDocuments[doc.id] = {
                    ...(cur || {}),
                    notRequired: true,
                    justification: (cur && cur.justification) ? cur.justification : 'Exonerado / No aplica'
                };
                modified++;
            }
        });

        if (modified > 0) {
            renderWizardDocs();
            triggerWizardAutosave();
        }
    });

    // Reset wizard
    document.getElementById('btn-reset-wizard')?.addEventListener('click', () => {
        if (confirm("¿Deseas restablecer todos los campos del asistente y descartar el borrador actual?")) {
            resetWizardForm();
        }
    });

    // Excel upload en Paso 3
    const dropZoneWiz = document.getElementById('drop-zone-wiz-oferta');
    const inputWizOferta = document.getElementById('input-wiz-oferta');
    if (dropZoneWiz && inputWizOferta) {
        dropZoneWiz.addEventListener('click', () => inputWizOferta.click());
        dropZoneWiz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZoneWiz.style.borderColor = 'var(--accent)';
            dropZoneWiz.style.background = 'rgba(5, 150, 105, 0.1)';
        });
        dropZoneWiz.addEventListener('dragleave', () => {
            dropZoneWiz.style.borderColor = 'var(--primary)';
            dropZoneWiz.style.background = 'rgba(0, 168, 89, 0.04)';
        });
        dropZoneWiz.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneWiz.style.borderColor = 'var(--primary)';
            dropZoneWiz.style.background = 'rgba(0, 168, 89, 0.04)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleWizardExcelUpload(e.dataTransfer.files[0]);
            }
        });
        inputWizOferta.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleWizardExcelUpload(e.target.files[0]);
            }
        });
    }

    // Botón descargar plantilla Excel
    document.getElementById('btn-download-offer-template')?.addEventListener('click', downloadContractorExcelTemplate);

    // Botón añadir fila de tarifa
    document.getElementById('btn-add-wiz-tariff-row')?.addEventListener('click', () => {
        wizardTarifas.push({
            rms: '',
            descripcion: 'NUEVA ACTIVIDAD',
            tarifa: 0
        });
        renderWizardTariffTable();
        triggerWizardAutosave();
    });

    // Botón actualizar vista de contrato
    document.getElementById('btn-update-contract-preview')?.addEventListener('click', () => {
        renderContractPreview();
    });

    // Descarga de Word .docx
    document.getElementById('btn-download-contract-docx')?.addEventListener('click', downloadContractDocx);

    // Descarga de Ficha de Cumplimiento .docx
    const handleWizCompliance = () => {
        const data = getWizardData();
        downloadProviderComplianceDocx(data);
    };
    document.getElementById('btn-wiz-download-compliance')?.addEventListener('click', handleWizCompliance);
    document.getElementById('btn-wiz-download-compliance-bottom')?.addEventListener('click', handleWizCompliance);

    // Imprimir / Guardar PDF
    document.getElementById('btn-print-contract')?.addEventListener('click', () => {
        window.print();
    });

    // Finalizar Vinculación
    document.getElementById('btn-finish-onboarding')?.addEventListener('click', finishProviderOnboarding);

    // Configurar listeners de autoguardado en todos los inputs y botones de borrador
    setupWizardAutosaveListeners();

    // Inicializar checklist documental
    renderWizardDocs();
}

function setupWizardAutosaveListeners() {
    const container = document.getElementById('view-onboarding');
    if (!container) return;

    // Escuchar cambios en todos los inputs/selects del asistente
    const formElements = container.querySelectorAll('input, select, textarea');
    formElements.forEach(el => {
        if (el.type === 'file') return;
        el.addEventListener('input', triggerWizardAutosave);
        el.addEventListener('change', triggerWizardAutosave);
    });

    // Botones explícitos de "Guardar Borrador"
    document.getElementById('btn-save-wizard-draft-top')?.addEventListener('click', () => saveCurrentWizardAsDraft(true));
    document.getElementById('btn-wiz-draft-1')?.addEventListener('click', () => saveCurrentWizardAsDraft(true));
    document.getElementById('btn-wiz-draft-2')?.addEventListener('click', () => saveCurrentWizardAsDraft(true));
    document.getElementById('btn-wiz-draft-3')?.addEventListener('click', () => saveCurrentWizardAsDraft(true));
    document.getElementById('btn-wiz-draft-4')?.addEventListener('click', () => saveCurrentWizardAsDraft(true));

    // Botones del Banner de Borrador Activo
    document.getElementById('btn-draft-resume')?.addEventListener('click', () => {
        const draftJson = localStorage.getItem(STORAGE_KEY_WIZARD_DRAFT);
        if (draftJson) {
            const draft = JSON.parse(draftJson);
            loadDraftIntoForm(draft, draft.paso_actual || 1);
        }
    });
    document.getElementById('btn-draft-save-dir')?.addEventListener('click', () => saveCurrentWizardAsDraft(true));
    document.getElementById('btn-draft-discard')?.addEventListener('click', () => {
        if (confirm("¿Deseas descartar este borrador y limpiar el formulario?")) {
            resetWizardForm();
        }
    });
}

function goToWizardStep(stepNum) {
    currentWizardStep = stepNum;

    // Actualizar stepper visual
    document.querySelectorAll('.stepper-bar .step-item').forEach(item => {
        const s = parseInt(item.getAttribute('data-step'), 10);
        if (s === stepNum) {
            item.classList.add('active');
            item.classList.remove('completed');
        } else if (s < stepNum) {
            item.classList.remove('active');
            item.classList.add('completed');
        } else {
            item.classList.remove('active');
            item.classList.remove('completed');
        }
    });

    // Mostrar sección correspondiente
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`wizard-step-${i}`);
        if (stepEl) {
            if (i === stepNum) {
                stepEl.classList.remove('hidden');
                stepEl.classList.add('active');
            } else {
                stepEl.classList.add('hidden');
                stepEl.classList.remove('active');
            }
        }
    }

    if (stepNum === 2) {
        renderWizardDocs();
    } else if (stepNum === 3) {
        // Si no hay tarifas cargadas, precargar los estándares de Maestros como sugerencia
        if (wizardTarifas.length === 0) {
            loadDefaultMaestrosTariffs();
        }
        renderWizardTariffTable();
    } else if (stepNum === 4) {
        renderContractPreview();
        renderWizardRubricationSection();
    }

    window.scrollTo({ top: 120, behavior: 'smooth' });
}

function resetWizardForm() {
    isRestoringDraft = true;
    const ids = [
        'wiz-nombre-comercial', 'wiz-nombre-rep', 'wiz-cedula', 'wiz-ruc',
        'wiz-matricula', 'wiz-telefono', 'wiz-correo', 'wiz-direccion',
        'wiz-cuenta', 'wiz-titular', 'wiz-inss', 'wiz-profesion'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    wizardDocuments = {};
    wizardTarifas = [];
    wizardContratoRubricado = null;
    renderWizardRubricationSection();
    localStorage.removeItem(STORAGE_KEY_WIZARD_DRAFT);
    isRestoringDraft = false;

    const banner = document.getElementById('wizard-draft-banner');
    if (banner) banner.classList.add('hidden');

    const ind = document.getElementById('wizard-autosave-indicator');
    const txt = document.getElementById('wizard-autosave-text');
    if (ind && txt) {
        ind.classList.remove('saved');
        txt.textContent = 'Formulario limpio';
    }

    goToWizardStep(1);
}

// Renderizar Checklist Documental del Paso 2
function renderWizardDocs() {
    const container = document.getElementById('docs-checklist-container');
    if (!container) return;

    const regimen = document.getElementById('wiz-regimen')?.value || "Régimen de Cuota Fija";
    const reqDocs = DOCS_BY_REGIMEN[regimen] || DOCS_BY_REGIMEN["Régimen de Cuota Fija"];

    container.innerHTML = '';
    let completedCount = 0;

    reqDocs.forEach(doc => {
        const docState = wizardDocuments[doc.id] || { fileName: '', validated: false, notRequired: false, justification: '' };
        const isNotRequired = !!docState.notRequired;
        const isValidated = !isNotRequired && (docState.fileName && docState.validated);
        const isResolved = isNotRequired || isValidated;
        if (isResolved) completedCount++;

        let badgeHtml = '';
        if (isNotRequired) {
            badgeHtml = `<span class="status-badge not-required-badge">⚪ No Requerido</span>`;
        } else if (isValidated) {
            badgeHtml = `<span class="status-badge uploaded">✓ Validado</span>`;
        } else if (docState.fileName) {
            badgeHtml = `<span class="status-badge uploaded">Archivo Adjunto</span>`;
        } else {
            badgeHtml = `<span class="status-badge pending">Pendiente</span>`;
        }

        const card = document.createElement('div');
        card.className = `doc-checklist-card ${isValidated ? 'completed' : ''} ${isNotRequired ? 'not-required' : ''}`;
        card.innerHTML = `
            <div class="doc-card-top">
                <div style="flex: 1; padding-right: 0.5rem;">
                    <div class="doc-info-title">${doc.name}</div>
                    <div class="doc-info-sub">${doc.desc}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem;">
                    ${badgeHtml}
                    <label class="custom-checkbox-label" style="font-size: 0.78rem; color: #64748b; cursor: pointer; white-space: nowrap;" title="Marcar si este recaudo no aplica o está exonerado">
                        <input type="checkbox" data-toggle-not-req="${doc.id}" ${isNotRequired ? 'checked' : ''}>
                        <span>No es necesario</span>
                    </label>
                </div>
            </div>

            <div class="doc-card-body">
                ${isNotRequired ? `
                    <div class="doc-not-required-box">
                        <div style="font-size: 0.8rem; color: #475569; font-weight: 500; margin-bottom: 0.4rem;">
                            ⚪ Documento marcado como no necesario para este proveedor.
                        </div>
                        <input type="text" class="form-control" data-justification-doc="${doc.id}" 
                               placeholder="Motivo o justificación opcional (ej: No aplica, Exonerado por gerencia)" 
                               value="${(docState.justification || '').replace(/"/g, '&quot;')}" 
                               style="font-size: 0.8rem; padding: 0.35rem 0.6rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%;">
                    </div>
                ` : `
                    ${docState.fileName ? `
                        <div class="doc-file-preview">
                            <span title="${docState.fileName}">📄 ${docState.fileName}</span>
                            <button class="btn-icon" data-del-doc="${doc.id}" style="color: var(--danger); font-size: 0.9rem;" title="Eliminar archivo">🗑️</button>
                        </div>
                    ` : `
                        <div class="doc-upload-zone" data-upload-doc="${doc.id}">
                            <span style="font-size: 1.2rem; display: block; margin-bottom: 2px;">📎</span>
                            <span style="font-size: 0.8rem; font-weight: 600; color: var(--primary);">Adjuntar Archivo Digital (PDF / Imagen)</span>
                            <input type="file" data-file-input="${doc.id}" accept=".pdf, .png, .jpg, .jpeg" hidden>
                        </div>
                    `}

                    <div style="margin-top: 0.8rem; border-top: 1px dashed var(--glass-border); padding-top: 0.6rem;">
                        <label class="custom-checkbox-label" style="font-size: 0.82rem;">
                            <input type="checkbox" data-validate-doc="${doc.id}" ${docState.validated ? 'checked' : ''}>
                            <span>Documento verificado, vigente y sin tachaduras</span>
                        </label>
                    </div>
                `}
            </div>
        `;

        // Event listeners
        const toggleNotReq = card.querySelector(`[data-toggle-not-req="${doc.id}"]`);
        const justInput = card.querySelector(`[data-justification-doc="${doc.id}"]`);
        const uploadZone = card.querySelector(`[data-upload-doc="${doc.id}"]`);
        const fileInput = card.querySelector(`[data-file-input="${doc.id}"]`);
        const delBtn = card.querySelector(`[data-del-doc="${doc.id}"]`);
        const validateCheckbox = card.querySelector(`[data-validate-doc="${doc.id}"]`);

        toggleNotReq?.addEventListener('change', (e) => {
            if (!wizardDocuments[doc.id]) {
                wizardDocuments[doc.id] = { fileName: '', validated: false };
            }
            wizardDocuments[doc.id].notRequired = e.target.checked;
            if (e.target.checked && !wizardDocuments[doc.id].justification) {
                wizardDocuments[doc.id].justification = 'No aplica / Exonerado';
            }
            renderWizardDocs();
            triggerWizardAutosave();
        });

        justInput?.addEventListener('input', (e) => {
            if (!wizardDocuments[doc.id]) {
                wizardDocuments[doc.id] = { fileName: '', validated: false, notRequired: true };
            }
            wizardDocuments[doc.id].justification = e.target.value;
            triggerWizardAutosave();
        });

        uploadZone?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                wizardDocuments[doc.id] = {
                    ...(wizardDocuments[doc.id] || {}),
                    fileName: file.name,
                    size: file.size,
                    validated: true,
                    notRequired: false
                };
                renderWizardDocs();
                triggerWizardAutosave();
            }
        });

        delBtn?.addEventListener('click', () => {
            if (wizardDocuments[doc.id]) {
                delete wizardDocuments[doc.id].fileName;
                delete wizardDocuments[doc.id].size;
                wizardDocuments[doc.id].validated = false;
            }
            renderWizardDocs();
            triggerWizardAutosave();
        });

        validateCheckbox?.addEventListener('change', (e) => {
            if (!wizardDocuments[doc.id]) {
                wizardDocuments[doc.id] = { fileName: 'Documento en Físico Validado', size: 0, validated: e.target.checked };
            } else {
                wizardDocuments[doc.id].validated = e.target.checked;
            }
            renderWizardDocs();
            triggerWizardAutosave();
        });

        container.appendChild(card);
    });

    // Actualizar barra de progreso
    const total = reqDocs.length;
    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const progressText = document.getElementById('doc-progress-text');
    const progressFill = document.getElementById('doc-progress-fill');
    if (progressText) progressText.textContent = `${completedCount} de ${total} Resueltos (${pct}%)`;
    if (progressFill) progressFill.style.width = `${pct}%`;
}

// Tarifas sugeridas por defecto para Maestros SINSA
function loadDefaultMaestrosTariffs() {
    wizardTarifas = [
        { rms: '101026007', descripcion: 'INSTALACION AIRE ACONDICIONADO DE 12-24 MIL BTU', tarifa: 2563.40 },
        { rms: '101025389', descripcion: 'VISITA A DOMICILIO EN CONCEPTO DE DIAGNOSTICO', tarifa: 256.34 },
        { rms: '145518214', descripcion: 'VISITA WHATSAPP PARA FUTURA INSTALACION DE AIRE ACONDICIONADO', tarifa: 200.00 },
        { rms: '130196460', descripcion: 'INSTALACION DE PUNTO ELECTRICO', tarifa: 700.00 },
        { rms: '130196451', descripcion: 'DESINTALACION DE AIRE ACONDICIONADO >24 MIL BTU', tarifa: 800.00 },
        { rms: '137301040', descripcion: 'DESINSTALACION DE AIRE 12-18-24 MIL BTU', tarifa: 400.00 },
        { rms: '101026023', descripcion: 'MANTENIMIENTO PREVENTIVO AIRE ACONDICIONADO', tarifa: 750.00 },
        { rms: '101026031', descripcion: 'MANTENIMIENTO GENERAL DE AIRE ACONDICIONADO', tarifa: 1800.00 }
    ];
}

// Procesar Excel de Tarifas en el Wizard
function handleWizardExcelUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let headerRowIndex = -1;
            let rmsIndex = -1;
            let descIndex = -1;
            let tarifaIndex = -1;

            // Detectar encabezados
            for (let i = 0; i < Math.min(json.length, 10); i++) {
                const row = json[i];
                if (!row) continue;
                for (let j = 0; j < row.length; j++) {
                    const val = String(row[j] || '').toUpperCase().trim();
                    if (val === 'RMS' || val === 'CODIGO' || val === 'CÓDIGO') rmsIndex = j;
                    if (val.includes('DESCRIP') || val.includes('ACTIVIDAD')) descIndex = j;
                    if (val.includes('TARIFA') || val.includes('PRECIO') || val.includes('VALOR')) tarifaIndex = j;
                }
                if (descIndex !== -1 && (tarifaIndex !== -1 || rmsIndex !== -1)) {
                    headerRowIndex = i;
                    break;
                }
            }

            // Si no encontró tarifa explícita, buscar la columna numérica a la derecha de descripción
            if (tarifaIndex === -1 && descIndex !== -1) {
                tarifaIndex = descIndex + 1;
            }

            const extractedTarifas = [];
            let fuelExtracted = null;

            if (headerRowIndex !== -1 && descIndex !== -1) {
                for (let r = headerRowIndex + 1; r < json.length; r++) {
                    const row = json[r];
                    if (!row) continue;

                    const desc = String(row[descIndex] || '').trim();
                    if (!desc) continue;

                    const rms = rmsIndex !== -1 ? String(row[rmsIndex] || '').trim() : '';
                    let rawVal = row[tarifaIndex];
                    let price = 0;

                    if (typeof rawVal === 'number') {
                        price = rawVal;
                    } else if (rawVal) {
                        price = parseFloat(String(rawVal).replace(/,/g, '').replace(/[^0-9.-]+/g, '')) || 0;
                    }

                    // Verificar si es fila de combustible
                    if (desc.toUpperCase().includes('COMBUSTIBLE') || desc.toUpperCase().includes('CUMBUSTIBLE')) {
                        fuelExtracted = price || 12.0;
                    } else {
                        extractedTarifas.push({
                            rms: rms,
                            descripcion: desc,
                            tarifa: price
                        });
                    }
                }
            }

            if (extractedTarifas.length > 0) {
                wizardTarifas = extractedTarifas;
                if (fuelExtracted !== null) {
                    const fuelInput = document.getElementById('wiz-fuel-rate');
                    if (fuelInput) fuelInput.value = fuelExtracted.toFixed(2);
                }
                renderWizardTariffTable();
                alert(`¡Éxito! Se cargaron ${extractedTarifas.length} actividades desde el archivo Excel.`);
            } else {
                alert("No se pudieron detectar columnas de actividades en el Excel. Se mantendrán las tarifas actuales.");
            }
        } catch (err) {
            console.error(err);
            alert("Error al procesar el archivo Excel: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Renderizar Tabla de Tarifas en el Wizard
function renderWizardTariffTable() {
    const tbody = document.getElementById('wiz-tariff-body');
    const countLabel = document.getElementById('tariff-count-label');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (countLabel) countLabel.textContent = `Actividades Pactadas (${wizardTarifas.length})`;

    if (wizardTarifas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay actividades registradas. Arrastra un Excel o pulsa "➕ Añadir Actividad".</td></tr>`;
        return;
    }

    wizardTarifas.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" class="custom-input" data-t-rms="${idx}" value="${item.rms || ''}" placeholder="Ej. 101026007" style="font-size: 0.85rem; padding: 0.35rem 0.6rem; width: 100%;">
            </td>
            <td>
                <input type="text" class="custom-input" data-t-desc="${idx}" value="${item.descripcion || ''}" placeholder="Descripción del servicio" style="font-size: 0.85rem; padding: 0.35rem 0.6rem; width: 100%;">
            </td>
            <td style="text-align: right;">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.3rem;">
                    <span style="font-weight: bold; color: var(--primary);">C$</span>
                    <input type="number" class="custom-input" data-t-price="${idx}" value="${item.tarifa || 0}" step="10" style="font-size: 0.85rem; padding: 0.35rem 0.6rem; width: 120px; text-align: right; font-weight: 600;">
                </div>
            </td>
            <td style="text-align: center;">
                <button class="btn-icon" data-del-t="${idx}" style="color: var(--danger);" title="Eliminar fila">✖</button>
            </td>
        `;

        // Inputs change handlers
        tr.querySelector(`[data-t-rms="${idx}"]`)?.addEventListener('input', (e) => {
            wizardTarifas[idx].rms = e.target.value.trim();
        });
        tr.querySelector(`[data-t-desc="${idx}"]`)?.addEventListener('input', (e) => {
            wizardTarifas[idx].descripcion = e.target.value.trim();
        });
        tr.querySelector(`[data-t-price="${idx}"]`)?.addEventListener('input', (e) => {
            wizardTarifas[idx].tarifa = parseFloat(e.target.value) || 0;
        });
        tr.querySelector(`[data-del-t="${idx}"]`)?.addEventListener('click', () => {
            wizardTarifas.splice(idx, 1);
            renderWizardTariffTable();
        });

        tbody.appendChild(tr);
    });
}

// Descargar plantilla Excel de oferta
function downloadContractorExcelTemplate() {
    const wsData = [
        ["TABLA DE OFERTA CONTRATISTA DE MAESTROS"],
        ["RMS", "DESCRIPCION", "TARIFA"],
        ["101026007", "INSTALACION AIRE ACONDICIONADO DE 12-24 MIL BTU", 2563.40],
        ["101025389", "VISITA A DOMICILIO EN CONCEPTO DE DIAGNOSTICO", 256.34],
        ["145518214", "VISITA WHATSAPP PARA FUTURA INSTALACION DE AIRE ACONDICIONADO", 200.00],
        ["130196460", "INSTALACION DE PUNTO ELECTRICO", 700.00],
        ["130196451", "DESINTALACION DE AIRE ACONDICIONADO >24 MIL BTU", 800.00],
        ["137301040", "DESINSTALACION DE AIRE 12-18-24 MIL BTU", 400.00],
        ["101026023", "MANTENIMIENTO PREVENTIVO AIRE ACONDICIONADO", 750.00],
        ["101026031", "MANTENIMIENTO GENERAL DE AIRE ACONDICIONADO", 1800.00],
        ["", "TARIFA DE COMBUSTIBLE POR KM FUERA DEL RADIO DE LA CIUDAD", 12.00]
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Oferta");
    XLSX.writeFile(wb, "PLANTILLA_OFERTA_MAESTROS_SINSA.xlsx");
}

// Obtener los datos actuales del formulario sin inventar valores por defecto si están vacíos
function getWizardData() {
    return {
        nombre_comercial: document.getElementById('wiz-nombre-comercial')?.value.trim() || '',
        nombre_representante: document.getElementById('wiz-nombre-rep')?.value.trim() || '',
        cedula: document.getElementById('wiz-cedula')?.value.trim() || '',
        ruc: document.getElementById('wiz-ruc')?.value.trim() || '',
        matricula: document.getElementById('wiz-matricula')?.value.trim() || '',
        regimen: document.getElementById('wiz-regimen')?.value || 'Régimen de Cuota Fija',
        estado_civil: document.getElementById('wiz-estado-civil')?.value || 'casado',
        profesion: document.getElementById('wiz-profesion')?.value.trim() || 'técnico',
        domicilio: document.getElementById('wiz-domicilio')?.value.trim() || 'Managua',
        telefono: document.getElementById('wiz-telefono')?.value.trim() || '',
        correo: document.getElementById('wiz-correo')?.value.trim() || '',
        direccion: document.getElementById('wiz-direccion')?.value.trim() || '',
        banco: document.getElementById('wiz-banco')?.value || 'BAC Credomatic',
        cuenta_bancaria: document.getElementById('wiz-cuenta')?.value.trim() || '',
        titular_cuenta: document.getElementById('wiz-titular')?.value.trim() || document.getElementById('wiz-nombre-rep')?.value.trim() || '',
        inss: document.getElementById('wiz-inss')?.value.trim() || '',
        dia: parseInt(document.getElementById('contract-day')?.value, 10) || 23,
        mes: document.getElementById('contract-month')?.value || 'octubre',
        anio: 2026,
        tarifa_combustible: parseFloat(document.getElementById('wiz-fuel-rate')?.value) || 12.0,
        tarifas: wizardTarifas ? [...wizardTarifas] : [],
        documentos: wizardDocuments ? { ...wizardDocuments } : {},
        contrato_rubricado: wizardContratoRubricado ? JSON.parse(JSON.stringify(wizardContratoRubricado)) : null,
        estado_contrato: (wizardContratoRubricado && wizardContratoRubricado.fileName) ? 'RUBRICADO' : 'PENDIENTE_RUBRICA'
    };
}

// Renderizar Sección de Visto Bueno Legal y Carga de Contrato Rubricado en Paso 4
function renderWizardRubricationSection() {
    const container = document.getElementById('wizard-rubrication-box');
    if (!container) return;

    const hasFile = !!(wizardContratoRubricado && wizardContratoRubricado.fileName);

    let html = `
        <div class="rubrication-workflow-box ${hasFile ? 'has-file' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 0.8rem;">
                <div>
                    <h4 style="margin: 0; color: var(--primary); font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span>⚖️</span>
                        <span>Flujo de Aprobación Legal y Carga de Contrato Rubricado</span>
                    </h4>
                    <p style="margin: 0.3rem 0 0 0; font-size: 0.82rem; color: var(--text-muted); max-width: 680px;">
                        El borrador generado se somete a revisión y Visto Bueno (VoBo) del Área Legal. Una vez acordadas las adendas y rubricadas todas las páginas por ambas partes (SINSA y Contratista), adjunte el documento final.
                    </p>
                </div>
                <span class="badge-tag ${hasFile ? 'badge-rubricated' : 'badge-legal-pending'}" style="margin: 0;">
                    ${hasFile ? '✓ Contrato Final Rubricado' : '⏳ VoBo Legal / Rúbrica Pendiente'}
                </span>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.85rem; margin-bottom: 1rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem; font-size: 0.8rem;">
                    <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                        <span style="font-size: 1.1rem; line-height: 1;">1️⃣</span>
                        <div>
                            <strong>Descarga Borrador</strong>
                            <div style="color: var(--text-muted);">Descargue el .docx para remitir a Legal.</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                        <span style="font-size: 1.1rem; line-height: 1;">2️⃣</span>
                        <div>
                            <strong>VoBo Legal & Rúbricas</strong>
                            <div style="color: var(--text-muted);">Legal valida y se rubrica en cada una de las hojas.</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                        <span style="font-size: 1.1rem; line-height: 1;">3️⃣</span>
                        <div>
                            <strong>Carga Documento Final</strong>
                            <div style="color: var(--text-muted);">Adjunte el PDF o digital final para el expediente.</div>
                        </div>
                    </div>
                </div>
            </div>
    `;

    if (hasFile) {
        html += `
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 0.9rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="font-size: 1.8rem; line-height: 1;">📑</div>
                    <div>
                        <div style="font-weight: 700; color: #059669; font-size: 0.9rem;">
                            ${escapeHtml(wizardContratoRubricado.fileName)}
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                            <span>Tamaño: ${wizardContratoRubricado.fileSize || 'N/D'}</span> • 
                            <span>Cargado: ${wizardContratoRubricado.uploadDate || 'Hoy'}</span>
                            ${wizardContratoRubricado.observaciones ? ` • <span style="font-style: italic;">"${escapeHtml(wizardContratoRubricado.observaciones)}"</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button id="btn-wiz-view-rubricado" class="btn btn-outline" style="font-size: 0.82rem; color: #059669; border-color: rgba(16, 185, 129, 0.5);">
                        📥 Descargar / Ver
                    </button>
                    <button id="btn-wiz-change-rubricado" class="btn btn-outline" style="font-size: 0.82rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.4);">
                        🗑️ Reemplazar
                    </button>
                </div>
            </div>
            <input type="file" id="input-wiz-contrato-rubricado" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style="display: none;">
        `;
    } else {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; background: var(--bg-card); border: 1.5px dashed var(--glass-border); border-radius: 8px; padding: 1rem;">
                <div>
                    <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-main);">
                        ¿Ya cuenta con el contrato final revisado por Legal y rubricado por las partes?
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">
                        Suba el archivo escaneado (PDF, DOCX o imagen). Si el trámite con Legal sigue en curso, puede finalizar la vinculación y subirlo más adelante desde el <strong>Directorio</strong>.
                    </div>
                </div>
                <div>
                    <input type="file" id="input-wiz-contrato-rubricado" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style="display: none;">
                    <button id="btn-trigger-upload-wiz-rubricado" class="btn btn-outline" style="font-size: 0.85rem; border-color: var(--primary); color: var(--primary); font-weight: 600;">
                        📤 Subir Contrato Rubricado (.pdf / .docx)
                    </button>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;

    const inputWiz = document.getElementById('input-wiz-contrato-rubricado');
    const btnTrigger = document.getElementById('btn-trigger-upload-wiz-rubricado');
    const btnChange = document.getElementById('btn-wiz-change-rubricado');
    const btnView = document.getElementById('btn-wiz-view-rubricado');

    if (btnTrigger && inputWiz) {
        btnTrigger.addEventListener('click', () => inputWiz.click());
    }

    if (btnChange && inputWiz) {
        btnChange.addEventListener('click', () => inputWiz.click());
    }

    if (btnView && wizardContratoRubricado) {
        btnView.addEventListener('click', () => viewOrDownloadRubricatedFile(wizardContratoRubricado));
    }

    if (inputWiz) {
        inputWiz.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                wizardContratoRubricado = {
                    fileName: file.name,
                    fileSize: formatFileSize(file.size),
                    uploadDate: new Date().toLocaleString(),
                    dataUrl: dataUrl,
                    observaciones: 'Cargado durante formalización en asistente'
                };
                triggerWizardAutosave();
                renderWizardRubricationSection();
            };
            reader.readAsDataURL(file);
        });
    }
}

// Renderizar Vista Previa del Contrato Formal en Paso 4
function renderContractPreview() {
    const viewer = document.getElementById('contract-paper-viewer');
    const summaryBox = document.getElementById('provider-onboarding-summary');
    if (!viewer) return;

    const data = getWizardData();

    const provNameDisplay = data.nombre_comercial || 'CONTRATISTA EN PROCESO';
    const repNameDisplay = data.nombre_representante || '<span class="missing-field-highlight">[PENDIENTE: REPRESENTANTE LEGAL]</span>';
    const cedulaDisplay = data.cedula || '<span class="missing-field-highlight">[PENDIENTE: CÉDULA]</span>';
    const cuentaDisplay = data.cuenta_bancaria || '<span class="missing-field-highlight">[PENDIENTE: CUENTA BANCARIA]</span>';
    const titularDisplay = data.titular_cuenta || (data.nombre_representante || 'EL CONTRATISTA');
    const direccionDisplay = data.direccion || '<span class="missing-field-highlight">[PENDIENTE: DIRECCIÓN]</span>';
    const telefonoDisplay = data.telefono || '<span class="missing-field-highlight">[PENDIENTE: TELÉFONO]</span>';
    const correoDisplay = data.correo || '<span class="missing-field-highlight">[PENDIENTE: CORREO]</span>';
    const isPending = !data.cedula || !data.cuenta_bancaria || !data.nombre_representante;

    // Actualizar summary pill
    if (summaryBox) {
        summaryBox.innerHTML = `
            <div>
                <strong style="font-size: 1.05rem; color: var(--primary);">${provNameDisplay}</strong>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
                    Titular: ${data.nombre_representante || 'Pendiente'} | Cédula: ${data.cedula || 'Pendiente'} | ${data.regimen}
                    ${isPending ? '<span class="badge-tag badge-draft" style="margin-left: 8px; font-size: 0.72rem;">⚠️ Faltan datos requeridos para firma</span>' : ''}
                </div>
            </div>
            <div style="text-align: right; font-size: 0.85rem;">
                <span style="font-weight: 700; color: var(--text-main);">${data.tarifas.length} Actividades Tarifadas</span>
                <div style="color: var(--accent); font-weight: 600;">Combustible: C$${Number(data.tarifa_combustible).toFixed(2)}/km</div>
            </div>
        `;
    }

    // Construcción de la tabla de tarifas Anexo I en HTML
    let tableRowsHtml = '';
    data.tarifas.forEach(t => {
        tableRowsHtml += `
            <tr>
                <td style="text-align: center; font-weight: 600;">${t.rms || '-'}</td>
                <td>${t.descripcion}</td>
                <td style="text-align: right; font-weight: bold;">C$ ${Number(t.tarifa || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    tableRowsHtml += `
        <tr style="background: #F1F5F9; font-weight: bold;">
            <td colspan="2">TARIFA DE COMBUSTIBLE POR KM FUERA DEL RADIO DE LA CIUDAD (14 KM MANAGUA)</td>
            <td style="text-align: right; color: #00A859;">C$ ${Number(data.tarifa_combustible || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;

    const logoSrc = (typeof SINSA_LOGO_BASE64 !== 'undefined' && SINSA_LOGO_BASE64) 
        ? 'data:image/png;base64,' + SINSA_LOGO_BASE64 
        : 'sinsa_logo.png';

    viewer.innerHTML = `
        <div class="contract-header-logo-row">
            <img src="${logoSrc}" alt="SINSA" class="contract-header-logo" onerror="this.src='sinsa_logo.png'">
        </div>

        <div class="contract-header-title">
            CONTRATO DE SERVICIOS DE INSTALACION DE AIRES<br>ACONDICIONADOS.
        </div>

        <p style="text-align: justify; text-justify: inter-word;">
            Nosotros, <strong>OSCAR RENÉ VARGAS REYES</strong>, mayor de edad, casado, Master en Administración de Empresas, con domicilio en el municipio de Nindirí, departamento de Masaya, de tránsito por esta ciudad de Managua, con cédula de identidad nicaragüense número cuatrocientos uno guión doscientos cincuenta y un mil doscientos setenta y uno guión cuatro ceros letra "W" (401-251271-0000W), quien comparece en nombre y representación de la sociedad mercantil denominada <strong>SILVA INTERNACIONAL, SOCIEDAD ANÓNIMA</strong>, que se abrevia <strong>"SINSA"</strong>, sociedad anónima constituida y existente de conformidad con las leyes de la República de Nicaragua, mediante Escritura Pública número doce (12), autorizada en la ciudad de Managua a las dos de la tarde del cuatro de Septiembre de mil novecientos noventa, ante los oficios notariales del Doctor Luis Exequiel Alvarado Ramírez, debidamente inscrita bajo el número trece mil quinientos nueve (13,509), páginas doscientos noventa y dos a la trescientos (292/300), Tomo seiscientos setenta y cuatro (674), Libro Segundo de Sociedades, y páginas uno a la tres (1/3), Tomo seiscientos setenta y cinco (675), Libro Segundo de Sociedades, e inscrita con el número veintiséis mil trescientos sesenta y cinco (26,365), página doscientos treinta y cinco (235), Tomo ciento quince (115), Libro de Personas, ambas del Registro Público de la Propiedad Inmueble y Mercantil del departamento de Managua; cuya representación legal ostenta en su carácter de Apoderado General de Administración, lo que acredita mediante Testimonio de Escritura Pública número ciento noventa y dos (192) de Poder General de Administración, autorizada en la ciudad de Managua a las tres de la tarde del doce de Octubre del dos mil dieciséis ante los oficios notariales del Licenciado Juan Víctor Zamora Morales, e inscrita bajo el número único de inscripción mercantil MC guión XF cincuenta y cinco GP (MC-XF55GP), Asiento catorce (14), en el Registro Público Mercantil de Managua; y que para los efectos de este contrato en lo sucesivo se denominará simplemente como <strong>"EL CONTRATANTE"</strong>; y por otra parte, <strong>${data.nombre_representante ? data.nombre_representante.toUpperCase() : '<span class="missing-field-highlight">[PENDIENTE: REPRESENTANTE LEGAL]</span>'}</strong>, mayor de edad, ${(data.estado_civil || 'soltero').toLowerCase()}, ${(data.profesion || 'técnico').toLowerCase()}, con domicilio en ${data.domicilio || 'la ciudad de Managua'}, con cédula de identidad nicaragüense número: ${data.cedula ? `<strong>${data.cedula}</strong>` : '<span class="missing-field-highlight">[PENDIENTE: CÉDULA]</span>'}, quien actúa en nombre y representación del negocio mercantil bajo ${data.regimen || 'régimen tributario'} denominado <strong>${data.nombre_comercial ? data.nombre_comercial.toUpperCase() : '<span class="missing-field-highlight">[PENDIENTE: NOMBRE COMERCIAL]</span>'}</strong>${data.ruc ? ` con número RUC: <strong>${data.ruc}</strong>` : ''}, quien en adelante se denominará simplemente como <strong>"EL CONTRATISTA"</strong>, acordamos celebrar el presente <strong>CONTRATO DE SERVICIOS DE INSTALACION DE AIRES ACONDICIONADOS</strong>, el que se regirá bajo las siguientes cláusulas y estipulaciones:
        </p>

        <div class="contract-clause-title">PRIMERA [OBJETO DEL CONTRATO]:</div>
        <p style="text-align: justify;">Por medio del presente documento, <strong>EL CONTRATANTE</strong> contrata los servicios profesionales independientes de <strong>EL CONTRATISTA</strong> para que ejecute labores de instalación, desinstalación y mantenimiento preventivo de equipos de aires acondicionados, así como obras accesorias inherentes tales como pintura, metalurgia, plomería, instalación de rejas metálicas y canaletas que resulten necesarias para la correcta culminación de los trabajos encomendados por los clientes de <strong>EL CONTRATANTE</strong>.</p>

        <div class="contract-clause-title">SEGUNDA [ALCANCES DEL CONTRATO]:</div>
        <p>Los alcances de los servicios a brindar por parte de <strong>EL CONTRATISTA</strong> comprenden:</p>
        <ul class="contract-clause-list">
            <li><strong>Sección 1 (Visita previa):</strong> Presentarse en el sitio o inmueble indicado por <strong>EL CONTRATANTE</strong>, inspeccionar las condiciones físicas, eléctricas y mecánicas del área de instalación, y determinar la factibilidad técnica y los insumos complementarios requeridos.</li>
            <li><strong>Sección 2 (Lista de materiales):</strong> Remitir al personal de Centro de Servicios de <strong>EL CONTRATANTE</strong> el informe técnico detallado y la lista de materiales adicionales no contemplados en el kit básico que deban ser presupuestados y facturados al cliente final.</li>
            <li><strong>Sección 3 (Ejecución e instalación en residencias o comercios):</strong> Ejecutar las instalaciones de equipos de aire acondicionado tipo Split u otras capacidades asignadas, cumpliendo estrictamente los estándares técnicos del fabricante, pruebas de vacío con bomba, sellado hermético de tuberías, fijación segura de condensadoras y evaporadoras, limpieza del área de trabajo y entrega a entera satisfacción del cliente.</li>
        </ul>

        <div class="contract-clause-title">TERCERA [DOCUMENTOS INTEGRALES DEL CONTRATO]:</div>
        <p>Forman parte integrante del presente contrato los siguientes documentos:</p>
        <ol class="contract-clause-numbered">
            <li>El Anexo I que contiene la Tabla Oficial de Códigos RMS, Descripción de Actividades y Tarifas de Servicios vigentes, así como la tarifa de combustible por kilómetro adicional fuera del radio de Managua.</li>
            <li>Las Órdenes de Compra (OC) y Órdenes de Servicio (OT) emitidas por <strong>EL CONTRATANTE</strong> para cada labor asignada.</li>
            <li>El Procedimiento Operativo y Políticas de Proveedores de Servicios Tercerizados de <strong>EL CONTRATANTE</strong>.</li>
            <li>Las Hojas de Visita, Protocolos de Levantamiento y Actas de Recepción a Satisfacción firmadas por el cliente final receptor del servicio.</li>
            <li>Las Facturas Comerciales o Recibos Oficiales emitidos conforme a la legislación tributaria aplicable.</li>
        </ol>

        <div class="contract-clause-title">CUARTA [OBLIGACIONES DEL CONTRATISTA]:</div>
        <p><strong>EL CONTRATISTA</strong> se compromete formalmente a:</p>
        <ol class="contract-clause-numbered">
            <li>Portar en todo momento el uniforme reglamentario con la identificación o logo proporcionado por <strong>EL CONTRATANTE</strong> (Centro de Servicios / Maestros), manteniendo una imagen pulcra y profesional.</li>
            <li>Se prohíbe de manera expresa a <strong>EL CONTRATISTA</strong> y a su personal portar uniformes, distintivos, gorras o utilizar vehículos con logotipos o publicidad de su propia marca comercial mientras preste los servicios objeto de este contrato.</li>
            <li>Brindar a los clientes un trato sumamente respetuoso, puntual, cordial y transparente en cada visita técnica.</li>
            <li>Llevar a cabo los trabajos de instalación y mantenimiento de conformidad con los manuales de los fabricantes, las especificaciones de <strong>EL CONTRATANTE</strong> y las normas técnicas aplicables en Nicaragua.</li>
            <li>Reportar inmediatamente a los coordinadores de <strong>EL CONTRATANTE</strong> cualquier incidencia, negativa de acceso del cliente, daño preexistente en el inmueble o imposibilidad técnica sobrevenida.</li>
            <li>Cumplir estrictamente con la programación de citas y horarios previamente coordinados con el cliente y notificados por <strong>EL CONTRATANTE</strong>.</li>
            <li>Abstenerse de ofrecer, pactar o realizar trabajos adicionales directos o cobros particulares en efectivo al cliente final sin la debida canalización a través de <strong>EL CONTRATANTE</strong>.</li>
            <li>Asumir de forma exclusiva e inmediata el costo total de reparaciones o reposición de equipos en caso de daños causados por impericia, negligencia, mala instalación o caídas atribuibles a su personal técnico.</li>
            <li>Responder diligentemente a los reclamos por garantías presentados por los clientes dentro del período de garantía estipulado, sin costo adicional alguno para <strong>EL CONTRATANTE</strong> ni para el cliente.</li>
            <li>Cumplir estrictamente con la Ley N.º 618, Ley General de Higiene y Seguridad del Trabajo de Nicaragua, asegurando que todo su personal porte el Equipo de Protección Personal (EPP) indispensable: arnés de seguridad para trabajos en altura mayores a 1.80 metros, casco, calzado dieléctrico, guantes y lentes de protección.</li>
        </ol>

        <div class="contract-clause-title">QUINTA [PLAZO DEL CONTRATO]:</div>
        <p style="text-align: justify;">El plazo del presente contrato es de DOCE (12) MESES calendario, contados a partir de la fecha de su suscripción. Este plazo se prorrogará automáticamente por períodos sucesivos de igual duración, salvo que cualquiera de las partes notifique por escrito a la otra su decisión de no renovarlo con al menos treinta (30) días de anticipación a la fecha de vencimiento.</p>

        <div class="contract-clause-title">SEXTA [VALOR DEL CONTRATO Y FORMA DE PAGO]:</div>
        <p style="text-align: justify;">El valor de los servicios contratados se liquidará conforme a las tarifas unitarias estipuladas en el Anexo I del presente instrumento. Los pagos se procesarán de manera semanal, previa presentación de la factura comercial debidamente autorizada por la DGI junto con las Órdenes de Trabajo y Actas de Recepción firmadas a entera satisfacción por los clientes. <strong>EL CONTRATANTE</strong> efectuará las retenciones tributarias correspondientes conforme la Ley de Concertación Tributaria (Ley 822) y acreditará los fondos netos mediante transferencia bancaria a la cuenta número: ${cuentaDisplay} del banco <strong>${(data.banco || 'Banco').toUpperCase()}</strong> en moneda córdobas a nombre de <strong>${titularDisplay}</strong>.</p>

        <div class="contract-clause-title">SÉPTIMA [MANTENIMIENTO DE VALOR]:</div>
        <p style="text-align: justify;">Las partes convienen expresamente que las sumas pactadas en moneda nacional gozan de la cláusula de mantenimiento de valor respecto al tipo de cambio oficial del Córdoba respecto al Dólar de los Estados Unidos de América emitido por el Banco Central de Nicaragua, de conformidad con lo prescrito en el Artículo 38 de la Ley de Régimen Monetario (Ley 732).</p>

        <div class="contract-clause-title">OCTAVA [RELACIÓN COMERCIAL Y RESPONSABILIDAD LABORAL]:</div>
        <p style="text-align: justify;">Queda claramente convenido que la relación jurídica que une a las partes es de naturaleza estrictamente civil y mercantil independiente, por lo que no existe ni existirá ningún vínculo de subordinación laboral ni relación obrero-patronal entre <strong>EL CONTRATANTE</strong> y el personal dependiente o subcontratado por <strong>EL CONTRATISTA</strong>. En consecuencia, <strong>EL CONTRATISTA</strong> asume la responsabilidad exclusiva por el pago de salarios, prestaciones sociales, seguro social (INSS), aportes al INATEC y demás obligaciones laborales vigentes en la República de Nicaragua respecto a su personal.</p>

        <div class="contract-clause-title">NOVENA [CONOCIMIENTOS TÉCNICOS Y CAPACIDAD]:</div>
        <p style="text-align: justify;"><strong>EL CONTRATISTA</strong> declara bajo promesa de ley que cuenta con los conocimientos técnicos, experiencia profesional comprobada, personal idóneo y licencias necesarias para desempeñar cabalmente los servicios encomendados, obligándose a ejecutar cada trabajo bajo las mejores prácticas de la ingeniería y refrigeración.</p>

        <div class="contract-clause-title">DÉCIMA [GARANTÍA DE LOS TRABAJOS Y RESPONSABILIDAD CIVIL]:</div>
        <p style="text-align: justify;"><strong>EL CONTRATISTA</strong> otorga una garantía de DOCE (12) MESES calendario sobre la mano de obra de las instalaciones realizadas, contados a partir de la firma del Acta de Entrega y Recepción por el cliente. Si durante este plazo se presentaren fallas derivadas de una deficiente instalación, fuga de refrigerante por mala abocardadura o deficiencias en conexiones eléctricas, <strong>EL CONTRATISTA</strong> corregirá de inmediato el daño sin costo alguno. Asimismo, responderá ante cualquier reclamación o demanda por daños a terceros provocados en la ejecución de los servicios.</p>

        <div class="contract-clause-title">DÉCIMA PRIMERA [PENALIZACIONES Y MULTAS]:</div>
        <p style="text-align: justify;">El incumplimiento injustificado en los tiempos de entrega, retrasos en la atención de visitas o inasistencia a citas concertadas con los clientes facultará a <strong>EL CONTRATANTE</strong> a deducir una penalidad equivalente al uno punto veinticinco por ciento (1.25%) diario sobre el valor total de la orden de trabajo correspondiente, hasta por un período máximo de ocho (8) días hábiles, tras lo cual <strong>EL CONTRATANTE</strong> podrá rescindir unilateralmente el servicio y reasignarlo a otro proveedor, deduciendo los costos sobrevenidos a <strong>EL CONTRATISTA</strong>.</p>

        <div class="contract-clause-title">DÉCIMA SEGUNDA [PROHIBICIÓN DE CESIÓN]:</div>
        <p style="text-align: justify;"><strong>EL CONTRATISTA</strong> no podrá ceder, transferir ni delegar total ni parcialmente los derechos, obligaciones o servicios derivados del presente contrato a favor de terceras personas naturales o jurídicas, sin el previo consentimiento expreso y por escrito de <strong>EL CONTRATANTE</strong>.</p>

        <div class="contract-clause-title">DÉCIMA TERCERA [MODIFICACIONES Y ADENDAS]:</div>
        <p style="text-align: justify;">Cualquier modificación a los términos, condiciones, alcances o tarifas de este contrato deberá constar por escrito mediante Adenda debidamente rubricada y suscrita por los representantes autorizados de ambas partes.</p>

        <div class="contract-clause-title">DÉCIMA CUARTA [CONFIDENCIALIDAD]:</div>
        <p style="text-align: justify;"><strong>EL CONTRATISTA</strong> se obliga a guardar estricta confidencialidad respecto a toda la información técnica, comercial, listados de clientes, números de teléfono, direcciones domiciliares y procedimientos internos a los que tenga acceso en ocasión de la ejecución del presente contrato, no pudiendo revelarla ni emplearla para fines ajenos a la prestación del servicio.</p>

        <div class="contract-clause-title">DÉCIMA QUINTA [AVISOS Y NOTIFICACIONES]:</div>
        <p>Todas las comunicaciones, avisos y notificaciones entre las partes se considerarán válidamente efectuadas en las siguientes direcciones:</p>
        <ul class="contract-clause-list">
            <li><strong>EL CONTRATANTE:</strong> Oficinas de Centro de Servicios SINSA, Centro de Distribución (CEDI), Rotonda El Periodista 100 metros al Este, Managua, Nicaragua. Con Atención a: <strong>JOSE ALFREDO RAUDES ORTIZ / ÁNGEL CAMPOS</strong> (Tel: 7886-2226 / 8267-2246 - Correo: jose.raudes@sinsa.com.ni).</li>
            <li><strong>EL CONTRATISTA:</strong> ${provNameDisplay}, con domicilio en ${direccionDisplay}. Con Atención a: ${repNameDisplay} (Teléfono: ${telefonoDisplay} - Correo Electrónico: ${correoDisplay}).</li>
        </ul>
        <p style="text-align: justify;">Cualquier cambio de domicilio o datos de contacto deberá notificarse formalmente por escrito con al menos veinticuatro (24) horas de anticipación para que surta plenos efectos legales.</p>

        <div class="contract-clause-title">DÉCIMA SEXTA [DOMICILIO CONTRACTUAL]:</div>
        <p style="text-align: justify;">Para todos los efectos legales y judiciales derivados del presente contrato, las partes fijan de común acuerdo como domicilio especial y contractual la ciudad de Managua, República de Nicaragua.</p>

        <div class="contract-clause-title">DÉCIMA SÉPTIMA [SOLUCIÓN DE CONTROVERSIAS]:</div>
        <p style="text-align: justify;">Cualquier discrepancia, desavenencia o controversia que surja entre las partes en relación con la interpretación, ejecución o terminación del presente contrato, será sometida en primer lugar a un trámite de mediación y conciliación ante la Dirección de Resolución Alterna de Conflictos (DIRAC). Si transcurrido un plazo de diez (10) días hábiles las partes no alcanzaren un acuerdo conciliatorio satisfactorio, la controversia se ventilará ante los juzgados ordinarios competentes del departamento de Managua.</p>

        <div class="contract-clause-title">DÉCIMA OCTAVA [EQUIPOS, HERRAMIENTAS E INSUMOS]:</div>
        <p style="text-align: justify;"><strong>EL CONTRATISTA</strong> suministrará a su propia costa todos los medios de transporte y movilización adecuados, así como las herramientas e instrumentos técnicos necesarios para la debida ejecución de los servicios (escaleras certificadas, bombas de vacío, manómetros digitales o análogos para refrigerantes R410A y R32, abocardadores excéntricos, llaves dinamométricas, amperímetros y multímetros). Cuando los materiales o repuestos de instalación sean provistos por <strong>EL CONTRATANTE</strong>, <strong>EL CONTRATISTA</strong> deberá retirarlos formalmente de las bodegas designadas presentando la orden respectiva.</p>

        <div class="contract-clause-title">DÉCIMA NOVENA [ACEPTACIÓN]:</div>
        <p style="text-align: justify;">Ambas partes declaran expresamente que conocen, entienden y aceptan todas y cada una de las cláusulas y estipulaciones contenidas en el presente contrato, encontrándolo redactado a entera conformidad y sin vicio alguno que pudiera invalidarlo, en fe de lo cual firmamos en dos (2) tantos de un mismo tenor y fuerza legal, en la ciudad de Managua, a los ${data.dia || new Date().getDate()} días del mes de ${data.mes || 'septiembre'} del año ${data.anio || 2026}.</p>

        <div class="contract-signatures-grid">
            <div>
                <div class="contract-sig-space"></div>
                <div class="contract-sig-line">EL CONTRATANTE</div>
                <div class="contract-sig-name">Oscar René Vargas Reyes</div>
                <div class="contract-sig-sub">SILVA INTERNACIONAL S.A. (SINSA)</div>
            </div>
            <div>
                <div class="contract-sig-space"></div>
                <div class="contract-sig-line">EL CONTRATISTA</div>
                <div class="contract-sig-name">${data.nombre_representante || '<span class="missing-field-highlight">[PENDIENTE: REPRESENTANTE]</span>'}</div>
                <div class="contract-sig-sub">${data.nombre_comercial || '<span class="missing-field-highlight">[PENDIENTE: NOMBRE COMERCIAL]</span>'}</div>
            </div>
        </div>

        <div style="page-break-before: always; margin-top: 3rem; border-top: 2px dashed #94A3B8; padding-top: 2rem;">
            <div class="contract-header-logo-row">
                <img src="${logoSrc}" alt="SINSA" class="contract-header-logo" onerror="this.src='sinsa_logo.png'">
            </div>
            <div style="text-align: center; font-weight: bold; font-size: 1.1rem; margin-bottom: 1.5rem; letter-spacing: 0.5px;">
                ANEXO I: TABLA DE OFERTA Y TARIFAS DE SERVICIOS - ${(data.nombre_comercial || 'CONTRATISTA').toUpperCase()}
            </div>
            <table class="contract-annex-table">
                <thead>
                    <tr>
                        <th style="width: 150px; text-align: center;">CODIGO</th>
                        <th>DESCRIPCION</th>
                        <th style="width: 170px; text-align: right;">PRECIO</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>

        <div class="contract-footer-page-row">
            Página Oficial de Contrato &bull; SILVA INTERNACIONAL S.A. (SINSA) &bull; Centro de Servicios
        </div>
    `;
}

// Función auxiliar para obtener el logo de SINSA en Uint8Array para docx.js
function getSinsaLogoUint8Array() {
    try {
        if (typeof SINSA_LOGO_BASE64 !== 'undefined' && SINSA_LOGO_BASE64) {
            const bin = window.atob(SINSA_LOGO_BASE64);
            const len = bin.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = bin.charCodeAt(i);
            }
            return bytes;
        }
    } catch (e) {
        console.warn("No se pudo obtener bytes de logo SINSA:", e);
    }
    return null;
}

// ==========================================================================
// GENERADOR NATIVO DE CONTRATO WORD (.DOCX) FIEL A LA PREVISUALIZACIÓN Y FORMATO OFICIAL
// ==========================================================================

async function buildDocxFromContractData(data) {
    if (!window.docx) throw new Error("Librería docx.js no cargada.");

    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, Header, Footer, PageNumber, ImageRun } = window.docx;

    const nomRep = (data.nombre_representante || data.nombre || 'REPRESENTANTE LEGAL').toUpperCase();
    const nomCom = (data.nombre_comercial || data.nombre || 'CONTRATISTA').toUpperCase();
    const cedula = data.cedula ? data.cedula.trim() : '[PENDIENTE: CÉDULA]';
    const ruc = data.ruc && data.ruc.trim() ? ' y cédula RUC: ' + data.ruc.trim() : '';
    const estCivil = (data.estado_civil || 'soltero').toLowerCase();
    const prof = (data.profesion || 'técnico').toLowerCase();
    const dom = data.domicilio || 'la ciudad de Managua';
    const reg = data.regimen || 'Régimen General';
    const banco = (data.banco || 'Banco').toUpperCase();
    const cta = data.cuenta_bancaria ? data.cuenta_bancaria.trim() : '[PENDIENTE: CUENTA BANCARIA]';
    const titular = (data.titular_cuenta || nomRep).toUpperCase();
    const dir = data.direccion || 'Managua, Nicaragua';
    const tel = data.telefono || 'Pendiente';
    const correo = data.correo || 'Pendiente';

    const now = new Date();
    const dia = data.dia || now.getDate();
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mes = data.mes || meses[now.getMonth()];
    const anio = data.anio || now.getFullYear();

    const combustible = Number(data.tarifa_combustible !== undefined ? data.tarifa_combustible : 12.0);

    // Obtener tarifas si están en data o en tablaOferta
    let tarifas = data.tarifas;
    if (!tarifas || tarifas.length === 0) {
        const provKey = data.nombre_comercial || data.nombre;
        const acts = (typeof tablaOferta !== 'undefined' && tablaOferta[provKey]) ? tablaOferta[provKey] : {};
        tarifas = Object.keys(acts).map(a => ({ rms: '', descripcion: a, tarifa: acts[a] }));
    }

    const font = 'Times New Roman';
    const sizeBody = 22; // 11pt
    const sizeTitle = 26; // 13pt
    const paragraphSpacing = { after: 140, line: 276 }; // 1.15 interlineado

    // Configurar encabezado con logo oficial SINSA y línea divisoria negra (tal como en CONTRADO ENERGY FIRMADO)
    const logoBytes = getSinsaLogoUint8Array();
    const headerChildren = [];
    if (logoBytes) {
        headerChildren.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
            children: [
                new ImageRun({
                    data: logoBytes,
                    transformation: { width: 90, height: 54 }
                })
            ]
        }));
    } else {
        headerChildren.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
            children: [
                new TextRun({ text: 'SILVA INTERNACIONAL S.A. (SINSA)', bold: true, font, size: 18 })
            ]
        }));
    }

    // Configurar pie de página con número de página "Página X de Y" y línea superior
    const footerChildren = [
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 120 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' } },
            children: [
                new TextRun({ text: 'Página ', font, size: 18, color: '64748B' }),
                new TextRun({ children: [PageNumber.CURRENT], font, size: 18, color: '64748B' }),
                new TextRun({ text: ' de ', font, size: 18, color: '64748B' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size: 18, color: '64748B' })
            ]
        })
    ];

    const sectionsChildren = [];

    // Título Principal Centrado
    sectionsChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
            new TextRun({ text: 'CONTRATO DE SERVICIOS DE INSTALACION DE AIRES ACONDICIONADOS.', bold: true, size: sizeTitle, font })
        ]
    }));

    // Preámbulo / Comparecencia Oficial Completa (con Escrituras 12 y 192)
    sectionsChildren.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: paragraphSpacing,
        children: [
            new TextRun({ text: 'Nosotros, ', font, size: sizeBody }),
            new TextRun({ text: 'OSCAR RENÉ VARGAS REYES', bold: true, font, size: sizeBody }),
            new TextRun({ text: ', mayor de edad, casado, Master en Administración de Empresas, con domicilio en el municipio de Nindirí, departamento de Masaya, de tránsito por esta ciudad de Managua, con cédula de identidad nicaragüense número cuatrocientos uno guión doscientos cincuenta y un mil doscientos setenta y uno guión cuatro ceros letra "W" (401-251271-0000W), quien comparece en nombre y representación de la sociedad mercantil denominada ', font, size: sizeBody }),
            new TextRun({ text: 'SILVA INTERNACIONAL, SOCIEDAD ANÓNIMA', bold: true, font, size: sizeBody }),
            new TextRun({ text: ', que se abrevia ', font, size: sizeBody }),
            new TextRun({ text: '"SINSA"', bold: true, font, size: sizeBody }),
            new TextRun({ text: ', sociedad anónima constituida y existente de conformidad con las leyes de la República de Nicaragua, mediante Escritura Pública número doce (12), autorizada en la ciudad de Managua a las dos de la tarde del cuatro de Septiembre de mil novecientos noventa, ante los oficios notariales del Doctor Luis Exequiel Alvarado Ramírez, debidamente inscrita bajo el número trece mil quinientos nueve (13,509), páginas doscientos noventa y dos a la trescientos (292/300), Tomo seiscientos setenta y cuatro (674), Libro Segundo de Sociedades, y páginas uno a la tres (1/3), Tomo seiscientos setenta y cinco (675), Libro Segundo de Sociedades, e inscrita con el número veintiséis mil trescientos sesenta y cinco (26,365), página doscientos treinta y cinco (235), Tomo ciento quince (115), Libro de Personas, ambas del Registro Público de la Propiedad Inmueble y Mercantil del departamento de Managua; cuya representación legal ostenta en su carácter de Apoderado General de Administración, lo que acredita mediante Testimonio de Escritura Pública número ciento noventa y dos (192) de Poder General de Administración, autorizada en la ciudad de Managua a las tres de la tarde del doce de Octubre del dos mil dieciséis ante los oficios notariales del Licenciado Juan Víctor Zamora Morales, e inscrita bajo el número único de inscripción mercantil MC guión XF cincuenta y cinco GP (MC-XF55GP), Asiento catorce (14), en el Registro Público Mercantil de Managua; y que para los efectos de este contrato en lo sucesivo se denominará simplemente como ', font, size: sizeBody }),
            new TextRun({ text: '"EL CONTRATANTE"', bold: true, font, size: sizeBody }),
            new TextRun({ text: '; y por otra parte, ', font, size: sizeBody }),
            new TextRun({ text: nomRep, bold: true, font, size: sizeBody }),
            new TextRun({ text: ', mayor de edad, ' + estCivil + ', ' + prof + ', con domicilio en ' + dom + ', con cédula de identidad nicaragüense número: ', font, size: sizeBody }),
            new TextRun({ text: cedula, bold: true, font, size: sizeBody }),
            new TextRun({ text: ruc + ', quien actúa en nombre y representación del negocio mercantil bajo ' + reg + ' denominado ', font, size: sizeBody }),
            new TextRun({ text: nomCom, bold: true, font, size: sizeBody }),
            new TextRun({ text: ', quien en adelante se denominará simplemente como ', font, size: sizeBody }),
            new TextRun({ text: '"EL CONTRATISTA"', bold: true, font, size: sizeBody }),
            new TextRun({ text: ', acordamos celebrar el presente ', font, size: sizeBody }),
            new TextRun({ text: 'CONTRATO DE SERVICIOS DE INSTALACION DE AIRES ACONDICIONADOS', bold: true, font, size: sizeBody }),
            new TextRun({ text: ', el que se regirá bajo las siguientes cláusulas y estipulaciones:', font, size: sizeBody })
        ]
    }));

    // Helper para estructurar cláusulas oficiales
    function addClause(numTitle, bodyParagraphs) {
        sectionsChildren.push(new Paragraph({
            spacing: { before: 180, after: 60 },
            children: [
                new TextRun({ text: numTitle, bold: true, font, size: sizeBody })
            ]
        }));
        (Array.isArray(bodyParagraphs) ? bodyParagraphs : [bodyParagraphs]).forEach(bp => {
            sectionsChildren.push(new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: paragraphSpacing,
                children: typeof bp === 'string' ? [new TextRun({ text: bp, font, size: sizeBody })] : bp
            }));
        });
    }

    // CLÁUSULAS 1ª A 19ª IDÉNTICAS AL CONTRATO FIRMADO DE REFERENCIA
    addClause('PRIMERA [OBJETO DEL CONTRATO]:', 
        'Por medio del presente documento, EL CONTRATANTE contrata los servicios profesionales independientes de EL CONTRATISTA para que ejecute labores de instalación, desinstalación y mantenimiento preventivo de equipos de aires acondicionados, así como obras accesorias inherentes tales como pintura, metalurgia, plomería, instalación de rejas metálicas y canaletas que resulten necesarias para la correcta culminación de los trabajos encomendados por los clientes de EL CONTRATANTE.'
    );

    addClause('SEGUNDA [ALCANCES DEL CONTRATO]:', [
        'Los alcances de los servicios a brindar por parte de EL CONTRATISTA comprenden:',
        '• Sección 1 (Visita previa): Presentarse en el sitio o inmueble indicado por EL CONTRATANTE, inspeccionar las condiciones físicas, eléctricas y mecánicas del área de instalación, y determinar la factibilidad técnica y los insumos complementarios requeridos.',
        '• Sección 2 (Lista de materiales): Remitir al personal de Centro de Servicios de EL CONTRATANTE el informe técnico detallado y la lista de materiales adicionales no contemplados en el kit básico que deban ser presupuestados y facturados al cliente final.',
        '• Sección 3 (Ejecución e instalación en residencias o comercios): Ejecutar las instalaciones de equipos de aire acondicionado tipo Split u otras capacidades asignadas, cumpliendo estrictamente los estándares técnicos del fabricante, pruebas de vacío con bomba, sellado hermético de tuberías, fijación segura de condensadoras y evaporadoras, limpieza del área de trabajo y entrega a entera satisfacción del cliente.'
    ]);

    addClause('TERCERA [DOCUMENTOS INTEGRALES DEL CONTRATO]:', [
        'Forman parte integrante del presente contrato los siguientes documentos:',
        '1. El Anexo I que contiene la Tabla Oficial de Códigos RMS, Descripción de Actividades y Tarifas de Servicios vigentes, así como la tarifa de combustible por kilómetro adicional fuera del radio de Managua.',
        '2. Las Órdenes de Compra (OC) y Órdenes de Servicio (OT) emitidas por EL CONTRATANTE para cada labor asignada.',
        '3. El Procedimiento Operativo y Políticas de Proveedores de Servicios Tercerizados de EL CONTRATANTE.',
        '4. Las Hojas de Visita, Protocolos de Levantamiento y Actas de Recepción a Satisfacción firmadas por el cliente final receptor del servicio.',
        '5. Las Facturas Comerciales o Recibos Oficiales emitidos conforme a la legislación tributaria aplicable.'
    ]);

    addClause('CUARTA [OBLIGACIONES DEL CONTRATISTA]:', [
        'EL CONTRATISTA se compromete formalmente a:',
        '1. Portar en todo momento el uniforme reglamentario con la identificación o logo proporcionado por EL CONTRATANTE (Centro de Servicios / Maestros), manteniendo una imagen pulcra y profesional.',
        '2. Se prohíbe de manera expresa a EL CONTRATISTA y a su personal portar uniformes, distintivos, gorras o utilizar vehículos con logotipos o publicidad de su propia marca comercial mientras preste los servicios objeto de este contrato.',
        '3. Brindar a los clientes un trato sumamente respetuoso, puntual, cordial y transparente en cada visita técnica.',
        '4. Llevar a cabo los trabajos de instalación y mantenimiento de conformidad con los manuales de los fabricantes, las especificaciones de EL CONTRATANTE y las normas técnicas aplicables en Nicaragua.',
        '5. Reportar inmediatamente a los coordinadores de EL CONTRATANTE cualquier incidencia, negativa de acceso del cliente, daño preexistente en el inmueble o imposibilidad técnica sobrevenida.',
        '6. Cumplir estrictamente con la programación de citas y horarios previamente coordinados con el cliente y notificados por EL CONTRATANTE.',
        '7. Abstenerse de ofrecer, pactar o realizar trabajos adicionales directos o cobros particulares en efectivo al cliente final sin la debida canalización a través de EL CONTRATANTE.',
        '8. Asumir de forma exclusiva e inmediata el costo total de reparaciones o reposición de equipos en caso de daños causados por impericia, negligencia, mala instalación o caídas atribuibles a su personal técnico.',
        '9. Responder diligentemente a los reclamos por garantías presentados por los clientes dentro del período de garantía estipulado, sin costo adicional alguno para EL CONTRATANTE ni para el cliente.',
        '10. Cumplir estrictamente con la Ley N.º 618, Ley General de Higiene y Seguridad del Trabajo de Nicaragua, asegurando que todo su personal porte el Equipo de Protección Personal (EPP) indispensable: arnés de seguridad para trabajos en altura mayores a 1.80 metros, casco, calzado dieléctrico, guantes y lentes de protección.'
    ]);

    addClause('QUINTA [PLAZO DEL CONTRATO]:',
        'El plazo del presente contrato es de DOCE (12) MESES calendario, contados a partir de la fecha de su suscripción. Este plazo se prorrogará automáticamente por períodos sucesivos de igual duración, salvo que cualquiera de las partes notifique por escrito a la otra su decisión de no renovarlo con al menos treinta (30) días de anticipación a la fecha de vencimiento.'
    );

    addClause('SEXTA [VALOR DEL CONTRATO Y FORMA DE PAGO]:',
        'El valor de los servicios contratados se liquidará conforme a las tarifas unitarias estipuladas en el Anexo I del presente instrumento. Los pagos se procesarán de manera semanal, previa presentación de la factura comercial debidamente autorizada por la DGI junto con las Órdenes de Trabajo y Actas de Recepción firmadas a entera satisfacción por los clientes. EL CONTRATANTE efectuará las retenciones tributarias correspondientes conforme la Ley de Concertación Tributaria (Ley 822) y acreditará los fondos netos mediante transferencia bancaria a la cuenta número: ' + cta + ' del banco ' + banco + ' en moneda córdobas a nombre de ' + titular + '.'
    );

    addClause('SÉPTIMA [MANTENIMIENTO DE VALOR]:',
        'Las partes convienen expresamente que las sumas pactadas en moneda nacional gozan de la cláusula de mantenimiento de valor respecto al tipo de cambio oficial del Córdoba respecto al Dólar de los Estados Unidos de América emitido por el Banco Central de Nicaragua, de conformidad con lo prescrito en el Artículo 38 de la Ley de Régimen Monetario (Ley 732).'
    );

    addClause('OCTAVA [RELACIÓN COMERCIAL Y RESPONSABILIDAD LABORAL]:',
        'Queda claramente convenido que la relación jurídica que une a las partes es de naturaleza estrictamente civil y mercantil independiente, por lo que no existe ni existirá ningún vínculo de subordinación laboral ni relación obrero-patronal entre EL CONTRATANTE y el personal dependiente o subcontratado por EL CONTRATISTA. En consecuencia, EL CONTRATISTA asume la responsabilidad exclusiva por el pago de salarios, prestaciones sociales, seguro social (INSS), aportes al INATEC y demás obligaciones laborales vigentes en la República de Nicaragua respecto a su personal.'
    );

    addClause('NOVENA [CONOCIMIENTOS TÉCNICOS Y CAPACIDAD]:',
        'EL CONTRATISTA declara bajo promesa de ley que cuenta con los conocimientos técnicos, experiencia profesional comprobada, personal idóneo y licencias necesarias para desempeñar cabalmente los servicios encomendados, obligándose a ejecutar cada trabajo bajo las mejores prácticas de la ingeniería y refrigeración.'
    );

    addClause('DÉCIMA [GARANTÍA DE LOS TRABAJOS Y RESPONSABILIDAD CIVIL]:',
        'EL CONTRATISTA otorga una garantía de DOCE (12) MESES calendario sobre la mano de obra de las instalaciones realizadas, contados a partir de la firma del Acta de Entrega y Recepción por el cliente. Si durante este plazo se presentaren fallas derivadas de una deficiente instalación, fuga de refrigerante por mala abocardadura o deficiencias en conexiones eléctricas, EL CONTRATISTA corregirá de inmediato el daño sin costo alguno. Asimismo, responderá ante cualquier reclamación o demanda por daños a terceros provocados en la ejecución de los servicios.'
    );

    addClause('DÉCIMA PRIMERA [PENALIZACIONES Y MULTAS]:',
        'El incumplimiento injustificado en los tiempos de entrega, retrasos en la atención de visitas o inasistencia a citas concertadas con los clientes facultará a EL CONTRATANTE a deducir una penalidad equivalente al uno punto veinticinco por ciento (1.25%) diario sobre el valor total de la orden de trabajo correspondiente, hasta por un período máximo de ocho (8) días hábiles, tras lo cual EL CONTRATANTE podrá rescindir unilateralmente el servicio y reasignarlo a otro proveedor, deduciendo los costos sobrevenidos a EL CONTRATISTA.'
    );

    addClause('DÉCIMA SEGUNDA [PROHIBICIÓN DE CESIÓN]:',
        'EL CONTRATISTA no podrá ceder, transferir ni delegar total ni parcialmente los derechos, obligaciones o servicios derivados del presente contrato a favor de terceras personas naturales o jurídicas, sin el previo consentimiento expreso y por escrito de EL CONTRATANTE.'
    );

    addClause('DÉCIMA TERCERA [MODIFICACIONES Y ADENDAS]:',
        'Cualquier modificación a los términos, condiciones, alcances o tarifas de este contrato deberá constar por escrito mediante Adenda debidamente rubricada y suscrita por los representantes autorizados de ambas partes.'
    );

    addClause('DÉCIMA CUARTA [CONFIDENCIALIDAD]:',
        'EL CONTRATISTA se obliga a guardar estricta confidencialidad respecto a toda la información técnica, comercial, listados de clientes, números de teléfono, direcciones domiciliares y procedimientos internos a los que tenga acceso en ocasión de la ejecución del presente contrato, no pudiendo revelarla ni emplearla para fines ajenos a la prestación del servicio.'
    );

    addClause('DÉCIMA QUINTA [AVISOS Y NOTIFICACIONES]:', [
        'Todas las comunicaciones, avisos y notificaciones entre las partes se considerarán válidamente efectuadas en las siguientes direcciones:',
        '• EL CONTRATANTE: Oficinas de Centro de Servicios SINSA, Centro de Distribución (CEDI), Rotonda El Periodista 100 metros al Este, Managua, Nicaragua. Con Atención a: JOSE ALFREDO RAUDES ORTIZ / ÁNGEL CAMPOS (Tel: 7886-2226 / 8267-2246 - Correo: jose.raudes@sinsa.com.ni).',
        '• EL CONTRATISTA: ' + nomCom + ', con domicilio en ' + dir + '. Con Atención a: ' + nomRep + ' (Teléfono: ' + tel + ' - Correo Electrónico: ' + correo + ').',
        'Cualquier cambio de domicilio o datos de contacto deberá notificarse formalmente por escrito con al menos veinticuatro (24) horas de anticipación para que surta plenos efectos legales.'
    ]);

    addClause('DÉCIMA SEXTA [DOMICILIO CONTRACTUAL]:',
        'Para todos los efectos legales y judiciales derivados del presente contrato, las partes fijan de común acuerdo como domicilio especial y contractual la ciudad de Managua, República de Nicaragua.'
    );

    addClause('DÉCIMA SÉPTIMA [SOLUCIÓN DE CONTROVERSIAS]:',
        'Cualquier discrepancia, desavenencia o controversia que surja entre las partes en relación con la interpretación, ejecución o terminación del presente contrato, será sometida en primer lugar a un trámite de mediación y conciliación ante la Dirección de Resolución Alterna de Conflictos (DIRAC). Si transcurrido un plazo de diez (10) días hábiles las partes no alcanzaren un acuerdo conciliatorio satisfactorio, la controversia se ventilará ante los juzgados ordinarios competentes del departamento de Managua.'
    );

    addClause('DÉCIMA OCTAVA [EQUIPOS, HERRAMIENTAS E INSUMOS]:',
        'EL CONTRATISTA suministrará a su propia costa todos los medios de transporte y movilización adecuados, así como las herramientas e instrumentos técnicos necesarios para la debida ejecución de los servicios (escaleras certificadas, bombas de vacío, manómetros digitales o análogos para refrigerantes R410A y R32, abocardadores excéntricos, llaves dinamométricas, amperímetros y multímetros). Cuando los materiales o repuestos de instalación sean provistos por EL CONTRATANTE, EL CONTRATISTA deberá retirarlos formalmente de las bodegas designadas presentando la orden respectiva.'
    );

    addClause('DÉCIMA NOVENA [ACEPTACIÓN]:',
        'Ambas partes declaran expresamente que conocen, entienden y aceptan todas y cada una de las cláusulas y estipulaciones contenidas en el presente contrato, encontrándolo redactado a entera conformidad y sin vicio alguno que pudiera invalidarlo, en fe de lo cual firmamos en dos (2) tantos de un mismo tenor y fuerza legal, en la ciudad de Managua, a los ' + dia + ' días del mes de ' + mes + ' del año ' + anio + '.'
    );

    // Tabla de Firmas (Fiel al documento oficial: espacio para firma autógrafa y línea superior)
    const sigBorderNone = {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' }
    };

    const sigTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: sigBorderNone,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        borders: sigBorderNone,
                        children: [
                            new Paragraph({
                                spacing: { before: 800, after: 80 },
                                children: []
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                border: { top: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
                                spacing: { before: 80, after: 40 },
                                children: [
                                    new TextRun({ text: 'EL CONTRATANTE', bold: true, font, size: sizeBody })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 20 },
                                children: [
                                    new TextRun({ text: 'Oscar René Vargas Reyes', font, size: sizeBody })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: 'SILVA INTERNACIONAL S.A. (SINSA)', font, size: 18, color: '555555' })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 10, type: WidthType.PERCENTAGE },
                        borders: sigBorderNone,
                        children: [new Paragraph({})]
                    }),
                    new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        borders: sigBorderNone,
                        children: [
                            new Paragraph({
                                spacing: { before: 800, after: 80 },
                                children: []
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                border: { top: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
                                spacing: { before: 80, after: 40 },
                                children: [
                                    new TextRun({ text: 'EL CONTRATISTA', bold: true, font, size: sizeBody })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 20 },
                                children: [
                                    new TextRun({ text: nomRep, font, size: sizeBody })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: nomCom, font, size: 18, color: '555555' })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
    sectionsChildren.push(sigTable);

    // Salto de página para el Anexo I
    sectionsChildren.push(new Paragraph({
        pageBreakBefore: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
            new TextRun({ text: 'ANEXO I: TABLA DE OFERTA Y TARIFAS DE SERVICIOS - ' + nomCom, bold: true, size: 22, font })
        ]
    }));

    // Tabla de Tarifas Anexo I con encabezados CODIGO, DESCRIPCION, PRECIO
    const cellBorderSolid = {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
    };

    const tableHeaderRow = new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                borders: cellBorderSolid,
                shading: { fill: '0F172A' },
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CODIGO', bold: true, font, size: 18, color: 'FFFFFF' })] })]
            }),
            new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                borders: cellBorderSolid,
                shading: { fill: '0F172A' },
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'DESCRIPCION', bold: true, font, size: 18, color: 'FFFFFF' })] })]
            }),
            new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: cellBorderSolid,
                shading: { fill: '0F172A' },
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'PRECIO (C$)', bold: true, font, size: 18, color: 'FFFFFF' })] })]
            })
        ]
    });

    const tableRows = [tableHeaderRow];

    tarifas.forEach((t, idx) => {
        const bg = idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
        const priceStr = 'C$ ' + Number(t.tarifa || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 });
        tableRows.push(new TableRow({
            children: [
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: cellBorderSolid,
                    shading: { fill: bg },
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(t.rms || '-'), font, size: 18 })] })]
                }),
                new TableCell({
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    borders: cellBorderSolid,
                    shading: { fill: bg },
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: String(t.descripcion || ''), font, size: 18 })] })]
                }),
                new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorderSolid,
                    shading: { fill: bg },
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: priceStr, bold: true, font, size: 18 })] })]
                })
            ]
        }));
    });

    // Fila de Combustible
    const fuelPriceStr = 'C$ ' + combustible.toLocaleString('es-NI', { minimumFractionDigits: 2 });
    tableRows.push(new TableRow({
        children: [
            new TableCell({
                width: { size: 75, type: WidthType.PERCENTAGE },
                columnSpan: 2,
                borders: cellBorderSolid,
                shading: { fill: 'F1F5F9' },
                margins: { top: 90, bottom: 90, left: 100, right: 100 },
                children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'TARIFA DE COMBUSTIBLE POR KM FUERA DEL RADIO DE LA CIUDAD (14 KM MANAGUA)', bold: true, font, size: 18 })] })]
            }),
            new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: cellBorderSolid,
                shading: { fill: 'F1F5F9' },
                margins: { top: 90, bottom: 90, left: 100, right: 100 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fuelPriceStr, bold: true, font, size: 18, color: '00A859' })] })]
            })
        ]
    }));

    const annexTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
    });
    sectionsChildren.push(annexTable);

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font, size: sizeBody },
                    paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: paragraphSpacing }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                }
            },
            headers: headerChildren.length > 0 ? { default: new Header({ children: headerChildren }) } : undefined,
            footers: { default: new Footer({ children: footerChildren }) },
            children: sectionsChildren
        }]
    });

    return await window.docx.Packer.toBlob(doc);
}

// ==========================================================================
// GENERADOR OFICIAL DE FICHA DE CUMPLIMIENTO DOCUMENTAL Y REQUISITOS (.DOCX)
// ==========================================================================

async function buildComplianceDocx(prov) {
    if (!window.docx) throw new Error("Librería docx.js no cargada.");

    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, ShadingType } = window.docx;

    const provName = prov.nombre_comercial || prov.nombre || 'CONTRATISTA';
    const repName = prov.nombre_representante || provName;
    const cedula = prov.cedula || 'Pendiente';
    const ruc = prov.ruc || 'N/D';
    const matricula = prov.matricula || 'N/D';
    const regimen = prov.regimen || 'Régimen de Cuota Fija';
    const banco = prov.banco || 'BAC Credomatic';
    const cuenta = prov.cuenta_bancaria || 'Pendiente';
    const direccion = prov.direccion || 'Managua, Nicaragua';
    const telefono = prov.telefono || 'N/D';
    const correo = prov.correo || 'N/D';

    // Tarifas
    let tarifas = prov.tarifas;
    if (!tarifas || tarifas.length === 0) {
        const provKey = prov.nombre_comercial || prov.nombre;
        const acts = (typeof tablaOferta !== 'undefined' && tablaOferta[provKey]) ? tablaOferta[provKey] : {};
        tarifas = Object.keys(acts).map(a => ({ rms: '', descripcion: a, tarifa: acts[a] }));
    }

    const combustible = Number(prov.tarifa_combustible !== undefined ? prov.tarifa_combustible : 12.0);

    // Documentos y Regla de Cumplimiento
    const reqDocs = DOCS_BY_REGIMEN[regimen] || DOCS_BY_REGIMEN["Régimen de Cuota Fija"];
    const provDocs = prov.documentos || {};

    let totalDocs = reqDocs.length;
    let resolvedDocs = 0;
    reqDocs.forEach(d => {
        const docItem = provDocs[d.id] || {};
        if (docItem.notRequired || docItem.validated) {
            resolvedDocs++;
        }
    });

    const rubricado = prov.contrato_rubricado;
    const hasRubricado = !!(rubricado && rubricado.fileName);
    const is100Percent = (resolvedDocs === totalDocs) && (prov.estado === 'ACTIVO' || hasRubricado);

    const font = 'Times New Roman';
    const sizeBody = 20; // 10pt
    const sizeSmall = 18; // 9pt
    const sizeSub = 22; // 11pt
    const sizeTitle = 26; // 13pt

    const borderThin = {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
    };

    const noBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' }
    };

    const headerShading = { fill: '0F172A', type: ShadingType.CLEAR };
    const sectionShading = { fill: 'F1F5F9', type: ShadingType.CLEAR };
    const successShading = { fill: 'ECFDF5', type: ShadingType.CLEAR };
    const warningShading = { fill: 'FFFBEB', type: ShadingType.CLEAR };

    const children = [];

    // Header Institucional SINSA
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
            new TextRun({ text: 'SILVA INTERNACIONAL, S.A. (SINSA)', bold: true, size: 24, font, color: '00A859' })
        ]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
            new TextRun({ text: 'CENTRO DE SERVICIOS / GERENCIA DE OPERACIONES Y COMPRAS', bold: true, size: 18, font, color: '4B5563' })
        ]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
            new TextRun({ text: 'CONSTANCIA Y FICHA DE CUMPLIMIENTO DOCUMENTAL DE PROVEEDOR', bold: true, size: sizeTitle, font })
        ]
    }));

    // Status Banner Box
    const bannerTitle = is100Percent 
        ? '✓ EXPEDIENTE 100% CUMPLIDO - PROVEEDOR HOMOLOGADO Y ACTIVO EN PAGOS' 
        : `⏳ EXPEDIENTE EN REVISIÓN Y FORMALIZACIÓN (${resolvedDocs}/${totalDocs} RECAUDOS COMPLETADOS)`;
    const bannerColor = is100Percent ? '059669' : 'D97706';
    const bannerFill = is100Percent ? successShading : warningShading;

    const statusBox = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: borderThin,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        shading: bannerFill,
                        margins: { top: 120, bottom: 120, left: 160, right: 160 },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: bannerTitle, bold: true, font, size: sizeSub, color: bannerColor })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 60 },
                                children: [
                                    new TextRun({ text: `Emitido el: ${new Date().toLocaleDateString('es-NI')} | Conforme a la Política 10.PO.S01.0006 y Procedimiento 10.P.S01.0001 de SINSA`, font, size: sizeSmall, color: '4B5563' })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
    children.push(statusBox);
    children.push(new Paragraph({ spacing: { after: 180 }, children: [] }));

    // SECTION I: Datos Generales
    children.push(new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [
            new TextRun({ text: 'I. DATOS GENERALES Y FISCALES DEL PROVEEDOR', bold: true, font, size: sizeSub, color: '00A859' })
        ]
    }));

    const generalRows = [
        ['Nombre Comercial / Alias:', provName, 'Régimen Fiscal:', regimen],
        ['Representante Legal / Titular:', repName, 'Cédula de Identidad:', cedula],
        ['Cédula RUC:', ruc, 'Matrícula de Alcaldía:', matricula],
        ['Teléfono de Contacto:', telefono, 'Correo Electrónico:', correo],
        ['Dirección de Domicilio:', direccion, 'Banco y N.º Cuenta:', `${banco} - ${cuenta}`]
    ];

    const dataTableRows = generalRows.map(row => new TableRow({
        children: [
            new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: borderThin,
                shading: sectionShading,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: row[0], bold: true, font, size: sizeSmall })] })]
            }),
            new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                borders: borderThin,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: String(row[1] || '-'), font, size: sizeSmall })] })]
            }),
            new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                borders: borderThin,
                shading: sectionShading,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: row[2], bold: true, font, size: sizeSmall })] })]
            }),
            new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: borderThin,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: String(row[3] || '-'), font, size: sizeSmall })] })]
            })
        ]
    }));

    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: dataTableRows
    }));

    children.push(new Paragraph({ spacing: { after: 180 }, children: [] }));

    // SECTION II: Matriz de Verificación Documental
    children.push(new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [
            new TextRun({ text: 'II. MATRIZ DE REQUISITOS DOCUMENTALES Y VERIFICACIÓN EN VENTANILLA', bold: true, font, size: sizeSub, color: '00A859' })
        ]
    }));

    const docTableRows = [
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    width: { size: 6, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: headerShading,
                    margins: { top: 80, bottom: 80, left: 80, right: 80 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', bold: true, font, size: sizeSmall, color: 'FFFFFF' })] })]
                }),
                new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: headerShading,
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Documento Exigido', bold: true, font, size: sizeSmall, color: 'FFFFFF' })] })]
                }),
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: headerShading,
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Estatus', bold: true, font, size: sizeSmall, color: 'FFFFFF' })] })]
                }),
                new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: headerShading,
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Evidencia Digital / Justificación', bold: true, font, size: sizeSmall, color: 'FFFFFF' })] })]
                })
            ]
        })
    ];

    reqDocs.forEach((d, idx) => {
        const item = provDocs[d.id] || {};
        const isNotReq = !!item.notRequired;
        const hasDoc = !isNotReq && item.validated;

        let statusText = '⏳ PENDIENTE';
        let statusColor = 'DC2626';
        let detailText = 'Pendiente de entrega por el contratista';

        if (isNotReq) {
            statusText = '⚪ EXONERADO';
            statusColor = '6B7280';
            detailText = item.justification ? `No requerido — Justificación: "${item.justification}"` : 'Exonerado formalmente / No aplica';
        } else if (hasDoc) {
            statusText = '✓ VALIDADO';
            statusColor = '059669';
            detailText = `Archivo: ${item.fileName || 'Digitalizado en expediente'} (${item.fileSize || 'N/D'})`;
        }

        const bg = idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF';

        docTableRows.push(new TableRow({
            children: [
                new TableCell({
                    width: { size: 6, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: { fill: bg },
                    margins: { top: 60, bottom: 60, left: 80, right: 80 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), font, size: sizeSmall })] })]
                }),
                new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: { fill: bg },
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [
                        new Paragraph({ children: [new TextRun({ text: d.name, bold: true, font, size: sizeSmall })] }),
                        new Paragraph({ children: [new TextRun({ text: d.desc, font, size: 16, color: '555555' })] })
                    ]
                }),
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: { fill: bg },
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: statusText, bold: true, font, size: sizeSmall, color: statusColor })] })]
                }),
                new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: { fill: bg },
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: detailText, font, size: sizeSmall })] })]
                })
            ]
        }));
    });

    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: docTableRows
    }));

    children.push(new Paragraph({ spacing: { after: 180 }, children: [] }));

    // SECTION III: Formalización Legal y Contrato Rubricado
    children.push(new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [
            new TextRun({ text: 'III. FORMALIZACIÓN LEGAL Y CONTRATO MARCO RUBRICADO', bold: true, font, size: sizeSub, color: '00A859' })
        ]
    }));

    const legalRows = [
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: sectionShading,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Contrato Marco de Servicios:', bold: true, font, size: sizeSmall })] })]
                }),
                new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Generado y estandarizado conforme a políticas de contratación SINSA', font, size: sizeSmall })] })]
                })
            ]
        }),
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: sectionShading,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Estado de VoBo Legal y Rúbrica:', bold: true, font, size: sizeSmall })] })]
                }),
                new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: hasRubricado ? '✓ CONTRATO FINAL RUBRICADO Y VISTO BUENO OTORGADO' : '⏳ PENDIENTE DE VISTO BUENO LEGAL Y RÚBRICAS', bold: true, font, size: sizeSmall, color: hasRubricado ? '059669' : 'D97706' })] })]
                })
            ]
        }),
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: sectionShading,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Archivo Rubricado en Expediente:', bold: true, font, size: sizeSmall })] })]
                }),
                new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: hasRubricado ? `${rubricado.fileName} (${rubricado.fileSize || 'N/D'}) - Registrado el ${rubricado.uploadDate || 'N/D'}` : 'Sin archivo final rubricado adjunto', font, size: sizeSmall })] })]
                })
            ]
        }),
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: sectionShading,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Dictamen / Notas de Legal:', bold: true, font, size: sizeSmall })] })]
                }),
                new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: (hasRubricado && rubricado.observaciones) ? rubricado.observaciones : 'Sin observaciones registradas', font, size: sizeSmall })] })]
                })
            ]
        })
    ];

    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: legalRows
    }));

    children.push(new Paragraph({ spacing: { after: 180 }, children: [] }));

    // SECTION IV: Tarifario y Condiciones Comerciales
    children.push(new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [
            new TextRun({ text: `IV. TARIFARIO DE ACTIVIDADES AUTORIZADAS (${tarifas.length} ACTIVIDADES)`, bold: true, font, size: sizeSub, color: '00A859' })
        ]
    }));

    const tariffTableRows = [
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: headerShading,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'RMS', bold: true, font, size: sizeSmall, color: 'FFFFFF' })] })]
                }),
                new TableCell({
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: headerShading,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Descripción del Servicio', bold: true, font, size: sizeSmall, color: 'FFFFFF' })] })]
                }),
                new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: headerShading,
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Tarifa Acordada', bold: true, font, size: sizeSmall, color: 'FFFFFF' })] })]
                })
            ]
        })
    ];

    tarifas.forEach((t, idx) => {
        const bg = idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
        tariffTableRows.push(new TableRow({
            children: [
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: { fill: bg },
                    margins: { top: 50, bottom: 50, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(t.rms || '-'), font, size: sizeSmall })] })]
                }),
                new TableCell({
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: { fill: bg },
                    margins: { top: 50, bottom: 50, left: 100, right: 100 },
                    children: [new Paragraph({ children: [new TextRun({ text: t.descripcion, font, size: sizeSmall })] })]
                }),
                new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: borderThin,
                    shading: { fill: bg },
                    margins: { top: 50, bottom: 50, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `C$ ${Number(t.tarifa || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, bold: true, font, size: sizeSmall })] })]
                })
            ]
        }));
    });

    // Combustible
    tariffTableRows.push(new TableRow({
        children: [
            new TableCell({
                width: { size: 75, type: WidthType.PERCENTAGE },
                borders: borderThin,
                shading: sectionShading,
                columnSpan: 2,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ children: [new TextRun({ text: 'TARIFA DE COMBUSTIBLE POR KM FUERA DEL RADIO DE LA CIUDAD:', bold: true, font, size: sizeSmall })] })]
            }),
            new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                borders: borderThin,
                shading: sectionShading,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `C$ ${combustible.toLocaleString('es-NI', { minimumFractionDigits: 2 })}`, bold: true, font, size: sizeSmall, color: '00A859' })] })]
            })
        ]
    }));

    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tariffTableRows
    }));

    children.push(new Paragraph({ spacing: { after: 280 }, children: [] }));

    // SECTION V: Cuadro de Firmas Institucionales de Aprobación
    children.push(new Paragraph({
        spacing: { before: 180, after: 120 },
        children: [
            new TextRun({ text: 'V. APROBACIÓN Y CONFORMIDAD INSTITUCIONAL (SINSA)', bold: true, font, size: sizeSub, color: '00A859' })
        ]
    }));

    const signTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        children: [
                            new Paragraph({ spacing: { before: 500, after: 40 }, children: [] }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                border: { top: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
                                spacing: { before: 60, after: 20 },
                                children: [new TextRun({ text: 'Recepción y Ventanilla', bold: true, font, size: sizeSmall })]
                            }),
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Mesa de Proveedores SINSA', font, size: 16, color: '555555' })] })
                        ]
                    }),
                    new TableCell({
                        width: { size: 5, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        children: [new Paragraph({})]
                    }),
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        children: [
                            new Paragraph({ spacing: { before: 500, after: 40 }, children: [] }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                border: { top: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
                                spacing: { before: 60, after: 20 },
                                children: [new TextRun({ text: 'Validación de Tarifas', bold: true, font, size: sizeSmall })]
                            }),
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Coordinación de Maestros', font, size: 16, color: '555555' })] })
                        ]
                    }),
                    new TableCell({
                        width: { size: 5, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        children: [new Paragraph({})]
                    }),
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        children: [
                            new Paragraph({ spacing: { before: 500, after: 40 }, children: [] }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                border: { top: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
                                spacing: { before: 60, after: 20 },
                                children: [new TextRun({ text: 'VoBo Formalización', bold: true, font, size: sizeSmall })]
                            }),
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Asesoría Legal / Compras', font, size: 16, color: '555555' })] })
                        ]
                    })
                ]
            })
        ]
    });

    children.push(signTable);

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font, size: sizeBody },
                    paragraph: { alignment: AlignmentType.LEFT }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 }
                }
            },
            children
        }]
    });

    return await window.docx.Packer.toBlob(doc);
}

// Descargador de Ficha de Cumplimiento Documental
async function downloadProviderComplianceDocx(prov) {
    if (!prov) return;
    const provName = prov.nombre_comercial || prov.nombre || 'PROVEEDOR';
    const safeName = provName.replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
        if (!window.docx) {
            throw new Error("Librería docx.js no disponible.");
        }
        const blob = await buildComplianceDocx(prov);
        if (blob && blob.size > 1000) {
            saveBlobAsFile(blob, `FICHA_CUMPLIMIENTO_${safeName}.docx`);
        } else {
            throw new Error("El documento generado está vacío.");
        }
    } catch (e) {
        console.error("Error al generar Ficha de Cumplimiento:", e);
        alert("Error al generar la Ficha de Cumplimiento: " + e.message);
    }
}

// Descargar archivo Blob de forma segura y compatible con todos los navegadores
function saveBlobAsFile(blob, fileName) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 500);
}

// Descargador unificado de contrato
async function downloadContractDocxFile(data) {
    const safeName = (data.nombre_comercial || data.nombre || 'PROVEEDOR').replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. Método Principal: Generación cliente con docx.js (100% nativo, seguro, fiel a la previsualización)
    if (window.docx) {
        try {
            const blob = await buildDocxFromContractData(data);
            if (blob && blob.size > 2000) {
                saveBlobAsFile(blob, `CONTRATO_SERVICIOS_${safeName}.docx`);
                return;
            }
        } catch (e) {
            console.warn("Fallo generador local docx.js, intentando alternativa backend...", e);
        }
    }

    // 2. Método Secundario: Intentar backend /api/generate-contract si está activo
    try {
        const response = await fetch('/api/generate-contract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const blob = await response.blob();
            // IMPORTANTE: Verificar que el archivo no esté vacío (evita hoja en blanco)
            if (blob && blob.size > 2000) {
                saveBlobAsFile(blob, `CONTRATO_SERVICIOS_${safeName}.docx`);
                return;
            }
        }
    } catch (e) {
        console.log("Servidor backend no disponible o en entorno estático.");
    }

    // 3. Método de Respaldo: WordML Oficial compatible con Microsoft Word
    downloadWordMLContract(data);
}

// Descargar el Contrato en Word (.docx) desde el Paso 4 del Asistente
async function downloadContractDocx() {
    const data = getWizardData();
    const btn = document.getElementById('btn-download-contract-docx');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Generando documento Word...';
    }

    try {
        await downloadContractDocxFile(data);
    } catch (err) {
        console.error("Error al descargar contrato:", err);
        alert("Ocurrió un inconveniente al generar el contrato: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Descarga en formato WordML como fallback si docx.js no está en memoria
function downloadWordMLContract(data) {
    const safeName = (data.nombre_comercial || data.nombre || 'PROVEEDOR').replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomRep = (data.nombre_representante || data.nombre || 'REPRESENTANTE LEGAL').toUpperCase();
    const nomCom = (data.nombre_comercial || data.nombre || 'CONTRATISTA').toUpperCase();
    const cedula = data.cedula ? data.cedula.trim() : '[PENDIENTE: CÉDULA]';
    const ruc = data.ruc && data.ruc.trim() ? ' y cédula RUC: ' + data.ruc.trim() : '';
    const estCivil = (data.estado_civil || 'soltero').toLowerCase();
    const prof = (data.profesion || 'técnico').toLowerCase();
    const dom = data.domicilio || 'la ciudad de Managua';
    const reg = data.regimen || 'Régimen General';
    const banco = (data.banco || 'Banco').toUpperCase();
    const cta = data.cuenta_bancaria ? data.cuenta_bancaria.trim() : '[PENDIENTE: CUENTA BANCARIA]';
    const titular = (data.titular_cuenta || nomRep).toUpperCase();
    const dir = data.direccion || 'Managua, Nicaragua';
    const tel = data.telefono || 'Pendiente';
    const correo = data.correo || 'Pendiente';

    const now = new Date();
    const dia = data.dia || now.getDate();
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mes = data.mes || meses[now.getMonth()];
    const anio = data.anio || now.getFullYear();

    let tableRowsHtml = '';
    (data.tarifas || []).forEach(t => {
        tableRowsHtml += `
            <tr>
                <td style="text-align: center; border: 1pt solid #cbd5e1; padding: 5pt;">${t.rms || '-'}</td>
                <td style="border: 1pt solid #cbd5e1; padding: 5pt;">${t.descripcion}</td>
                <td style="text-align: right; font-weight: bold; border: 1pt solid #cbd5e1; padding: 5pt;">C$ ${Number(t.tarifa || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    tableRowsHtml += `
        <tr style="background-color: #F1F5F9; font-weight: bold;">
            <td colspan="2" style="border: 1pt solid #cbd5e1; padding: 5pt;">TARIFA DE COMBUSTIBLE POR KM FUERA DEL RADIO DE LA CIUDAD (14 KM MANAGUA)</td>
            <td style="text-align: right; border: 1pt solid #cbd5e1; padding: 5pt; color: #00A859;">C$ ${Number(data.tarifa_combustible || 12.0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;

    const logoHtml = (typeof SINSA_LOGO_BASE64 !== 'undefined' && SINSA_LOGO_BASE64)
        ? `<div style="text-align: right; border-bottom: 2pt solid #000000; padding-bottom: 6pt; margin-bottom: 18pt;">
             <img src="data:image/png;base64,${SINSA_LOGO_BASE64}" width="120" height="72" alt="SINSA" />
           </div>`
        : `<div style="text-align: right; border-bottom: 2pt solid #000000; padding-bottom: 6pt; margin-bottom: 18pt; font-weight: bold; font-size: 11pt;">
             SILVA INTERNACIONAL S.A. (SINSA)
           </div>`;

    const wordContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>CONTRATO DE SERVICIOS - ${nomCom}</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page { size: 8.5in 11in; margin: 1in; }
                body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.45; color: #000000; text-align: justify; }
                h1 { text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 16pt; }
                .clause-title { font-weight: bold; margin-top: 12pt; margin-bottom: 3pt; }
                ul, ol { margin: 4pt 0 8pt 20pt; padding-left: 0; }
                li { margin-bottom: 3pt; text-align: justify; }
                table { width: 100%; border-collapse: collapse; margin-top: 12pt; margin-bottom: 12pt; font-size: 9.5pt; }
                th { background-color: #0F172A; color: #FFFFFF; font-weight: bold; border: 1pt solid #000000; padding: 6pt; }
                .sig-table { width: 100%; border: none; margin-top: 36pt; }
                .sig-table td { width: 48%; border: none; text-align: center; vertical-align: top; }
                .sig-bar { border-top: 1pt solid #000000; width: 75%; margin: 0 auto; padding-top: 4pt; font-weight: bold; }
            </style>
        </head>
        <body>
            ${logoHtml}

            <h1>CONTRATO DE SERVICIOS DE INSTALACION DE AIRES ACONDICIONADOS.</h1>

            <p>Nosotros, <strong>OSCAR RENÉ VARGAS REYES</strong>, mayor de edad, casado, Master en Administración de Empresas, con domicilio en el municipio de Nindirí, departamento de Masaya, de tránsito por esta ciudad de Managua, con cédula de identidad nicaragüense número cuatrocientos uno guión doscientos cincuenta y un mil doscientos setenta y uno guión cuatro ceros letra "W" (401-251271-0000W), quien comparece en nombre y representación de la sociedad mercantil denominada <strong>SILVA INTERNACIONAL, SOCIEDAD ANÓNIMA</strong>, que se abrevia <strong>"SINSA"</strong>, sociedad anónima constituida y existente de conformidad con las leyes de la República de Nicaragua, mediante Escritura Pública número doce (12), autorizada en la ciudad de Managua a las dos de la tarde del cuatro de Septiembre de mil novecientos noventa, ante los oficios notariales del Doctor Luis Exequiel Alvarado Ramírez, debidamente inscrita bajo el número trece mil quinientos nueve (13,509), páginas doscientos noventa y dos a la trescientos (292/300), Tomo seiscientos setenta y cuatro (674), Libro Segundo de Sociedades, y páginas uno a la tres (1/3), Tomo seiscientos setenta y cinco (675), Libro Segundo de Sociedades, e inscrita con el número veintiséis mil trescientos sesenta y cinco (26,365), página doscientos treinta y cinco (235), Tomo ciento quince (115), Libro de Personas, ambas del Registro Público de la Propiedad Inmueble y Mercantil del departamento de Managua; cuya representación legal ostenta en su carácter de Apoderado General de Administración, lo que acredita mediante Testimonio de Escritura Pública número ciento noventa y dos (192) de Poder General de Administración, autorizada en la ciudad de Managua a las tres de la tarde del doce de Octubre del dos mil dieciséis ante los oficios notariales del Licenciado Juan Víctor Zamora Morales, e inscrita bajo el número único de inscripción mercantil MC guión XF cincuenta y cinco GP (MC-XF55GP), Asiento catorce (14), en el Registro Público Mercantil de Managua; y que para los efectos de este contrato en lo sucesivo se denominará simplemente como <strong>"EL CONTRATANTE"</strong>; y por otra parte, <strong>${nomRep}</strong>, mayor de edad, ${estCivil}, ${prof}, con domicilio en ${dom}, con cédula de identidad nicaragüense número: <strong>${cedula}</strong>${ruc}, quien actúa en nombre y representación del negocio mercantil bajo ${reg} denominado <strong>${nomCom}</strong>, quien en adelante se denominará simplemente como <strong>"EL CONTRATISTA"</strong>, acordamos celebrar el presente <strong>CONTRATO DE SERVICIOS DE INSTALACION DE AIRES ACONDICIONADOS</strong>, el que se regirá bajo las siguientes cláusulas y estipulaciones:</p>

            <div class="clause-title">PRIMERA [OBJETO DEL CONTRATO]:</div>
            <p>Por medio del presente documento, <strong>EL CONTRATANTE</strong> contrata los servicios profesionales independientes de <strong>EL CONTRATISTA</strong> para que ejecute labores de instalación, desinstalación y mantenimiento preventivo de equipos de aires acondicionados, así como obras accesorias inherentes tales como pintura, metalurgia, plomería, instalación de rejas metálicas y canaletas que resulten necesarias para la correcta culminación de los trabajos encomendados por los clientes de <strong>EL CONTRATANTE</strong>.</p>

            <div class="clause-title">SEGUNDA [ALCANCES DEL CONTRATO]:</div>
            <p>Los alcances de los servicios a brindar por parte de <strong>EL CONTRATISTA</strong> comprenden:</p>
            <ul>
                <li><strong>Sección 1 (Visita previa):</strong> Presentarse en el sitio o inmueble indicado por EL CONTRATANTE, inspeccionar las condiciones físicas, eléctricas y mecánicas del área de instalación, y determinar la factibilidad técnica y los insumos complementarios requeridos.</li>
                <li><strong>Sección 2 (Lista de materiales):</strong> Remitir al personal de Centro de Servicios de EL CONTRATANTE el informe técnico detallado y la lista de materiales adicionales no contemplados en el kit básico que deban ser presupuestados y facturados al cliente final.</li>
                <li><strong>Sección 3 (Ejecución e instalación en residencias o comercios):</strong> Ejecutar las instalaciones de equipos de aire acondicionado tipo Split u otras capacidades asignadas, cumpliendo estrictamente los estándares técnicos del fabricante, pruebas de vacío con bomba, sellado hermético de tuberías, fijación segura de condensadoras y evaporadoras, limpieza del área de trabajo y entrega a entera satisfacción del cliente.</li>
            </ul>

            <div class="clause-title">TERCERA [DOCUMENTOS INTEGRALES DEL CONTRATO]:</div>
            <p>Forman parte integrante del presente contrato los siguientes documentos:</p>
            <ol>
                <li>El Anexo I que contiene la Tabla Oficial de Códigos RMS, Descripción de Actividades y Tarifas de Servicios vigentes, así como la tarifa de combustible por kilómetro adicional fuera del radio de Managua.</li>
                <li>Las Órdenes de Compra (OC) y Órdenes de Servicio (OT) emitidas por EL CONTRATANTE para cada labor asignada.</li>
                <li>El Procedimiento Operativo y Políticas de Proveedores de Servicios Tercerizados de EL CONTRATANTE.</li>
                <li>Las Hojas de Visita, Protocolos de Levantamiento y Actas de Recepción a Satisfacción firmadas por el cliente final receptor del servicio.</li>
                <li>Las Facturas Comerciales o Recibos Oficiales emitidos conforme a la legislación tributaria aplicable.</li>
            </ol>

            <div class="clause-title">CUARTA [OBLIGACIONES DEL CONTRATISTA]:</div>
            <p><strong>EL CONTRATISTA</strong> se compromete formalmente a:</p>
            <ol>
                <li>Portar en todo momento el uniforme reglamentario con la identificación o logo proporcionado por EL CONTRATANTE (Centro de Servicios / Maestros), manteniendo una imagen pulcra y profesional.</li>
                <li>Se prohíbe de manera expresa a EL CONTRATISTA y a su personal portar uniformes, distintivos, gorras o utilizar vehículos con logotipos o publicidad de su propia marca comercial mientras preste los servicios objeto de este contrato.</li>
                <li>Brindar a los clientes un trato sumamente respetuoso, puntual, cordial y transparente en cada visita técnica.</li>
                <li>Llevar a cabo los trabajos de instalación y mantenimiento de conformidad con los manuales de los fabricantes, las especificaciones de EL CONTRATANTE y las normas técnicas aplicables en Nicaragua.</li>
                <li>Reportar inmediatamente a los coordinadores de EL CONTRATANTE cualquier incidencia, negativa de acceso del cliente, daño preexistente en el inmueble o imposibilidad técnica sobrevenida.</li>
                <li>Cumplir estrictamente con la programación de citas y horarios previamente coordinados con el cliente y notificados por EL CONTRATANTE.</li>
                <li>Abstenerse de ofrecer, pactar o realizar trabajos adicionales directos o cobros particulares en efectivo al cliente final sin la debida canalización a través de EL CONTRATANTE.</li>
                <li>Asumir de forma exclusiva e inmediata el costo total de reparaciones o reposición de equipos en caso de daños causados por impericia, negligencia, mala instalación o caídas atribuibles a su personal técnico.</li>
                <li>Responder diligentemente a los reclamos por garantías presentados por los clientes dentro del período de garantía estipulado, sin costo adicional alguno para EL CONTRATANTE ni para el cliente.</li>
                <li>Cumplir estrictamente con la Ley N.º 618, Ley General de Higiene y Seguridad del Trabajo de Nicaragua, asegurando que todo su personal porte el Equipo de Protección Personal (EPP) indispensable: arnés de seguridad para trabajos en altura mayores a 1.80 metros, casco, calzado dieléctrico, guantes y lentes de protección.</li>
            </ol>

            <div class="clause-title">QUINTA [PLAZO DEL CONTRATO]:</div>
            <p>El plazo del presente contrato es de DOCE (12) MESES calendario, contados a partir de la fecha de su suscripción. Este plazo se prorrogará automáticamente por períodos sucesivos de igual duración, salvo que cualquiera de las partes notifique por escrito a la otra su decisión de no renovarlo con al menos treinta (30) días de anticipación a la fecha de vencimiento.</p>

            <div class="clause-title">SEXTA [VALOR DEL CONTRATO Y FORMA DE PAGO]:</div>
            <p>El valor de los servicios contratados se liquidará conforme a las tarifas unitarias estipuladas en el Anexo I del presente instrumento. Los pagos se procesarán de manera semanal, previa presentación de la factura comercial debidamente autorizada por la DGI junto con las Órdenes de Trabajo y Actas de Recepción firmadas a entera satisfacción por los clientes. <strong>EL CONTRATANTE</strong> efectuará las retenciones tributarias correspondientes conforme la Ley de Concertación Tributaria (Ley 822) y acreditará los fondos netos mediante transferencia bancaria a la cuenta número: <strong>${cta}</strong> del banco <strong>${banco}</strong> en moneda córdobas a nombre de <strong>${titular}</strong>.</p>

            <div class="clause-title">SÉPTIMA [MANTENIMIENTO DE VALOR]:</div>
            <p>Las partes convienen expresamente que las sumas pactadas en moneda nacional gozan de la cláusula de mantenimiento de valor respecto al tipo de cambio oficial del Córdoba respecto al Dólar de los Estados Unidos de América emitido por el Banco Central de Nicaragua, de conformidad con lo prescrito en el Artículo 38 de la Ley de Régimen Monetario (Ley 732).</p>

            <div class="clause-title">OCTAVA [RELACIÓN COMERCIAL Y RESPONSABILIDAD LABORAL]:</div>
            <p>Queda claramente convenido que la relación jurídica que une a las partes es de naturaleza estrictamente civil y mercantil independiente, por lo que no existe ni existirá ningún vínculo de subordinación laboral ni relación obrero-patronal entre <strong>EL CONTRATANTE</strong> y el personal dependiente o subcontratado por <strong>EL CONTRATISTA</strong>. En consecuencia, <strong>EL CONTRATISTA</strong> asume la responsabilidad exclusiva por el pago de salarios, prestaciones sociales, seguro social (INSS), aportes al INATEC y demás obligaciones laborales vigentes en la República de Nicaragua respecto a su personal.</p>

            <div class="clause-title">NOVENA [CONOCIMIENTOS TÉCNICOS Y CAPACIDAD]:</div>
            <p><strong>EL CONTRATISTA</strong> declara bajo promesa de ley que cuenta con los conocimientos técnicos, experiencia profesional comprobada, personal idóneo y licencias necesarias para desempeñar cabalmente los servicios encomendados, obligándose a ejecutar cada trabajo bajo las mejores prácticas de la ingeniería y refrigeración.</p>

            <div class="clause-title">DÉCIMA [GARANTÍA DE LOS TRABAJOS Y RESPONSABILIDAD CIVIL]:</div>
            <p><strong>EL CONTRATISTA</strong> otorga una garantía de DOCE (12) MESES calendario sobre la mano de obra de las instalaciones realizadas, contados a partir de la firma del Acta de Entrega y Recepción por el cliente. Si durante este plazo se presentaren fallas derivadas de una deficiente instalación, fuga de refrigerante por mala abocardadura o deficiencias en conexiones eléctricas, <strong>EL CONTRATISTA</strong> corregirá de inmediato el daño sin costo alguno. Asimismo, responderá ante cualquier reclamación o demanda por daños a terceros provocados en la ejecución de los servicios.</p>

            <div class="clause-title">DÉCIMA PRIMERA [PENALIZACIONES Y MULTAS]:</div>
            <p>El incumplimiento injustificado en los tiempos de entrega, retrasos en la atención de visitas o inasistencia a citas concertadas con los clientes facultará a <strong>EL CONTRATANTE</strong> a deducir una penalidad equivalente al uno punto veinticinco por ciento (1.25%) diario sobre el valor total de la orden de trabajo correspondiente, hasta por un período máximo de ocho (8) días hábiles, tras lo cual <strong>EL CONTRATANTE</strong> podrá rescindir unilateralmente el servicio y reasignarlo a otro proveedor, deduciendo los costos sobrevenidos a <strong>EL CONTRATISTA</strong>.</p>

            <div class="clause-title">DÉCIMA SEGUNDA [PROHIBICIÓN DE CESIÓN]:</div>
            <p><strong>EL CONTRATISTA</strong> no podrá ceder, transferir ni delegar total ni parcialmente los derechos, obligaciones o servicios derivados del presente contrato a favor de terceras personas naturales o jurídicas, sin el previo consentimiento expreso y por escrito de <strong>EL CONTRATANTE</strong>.</p>

            <div class="clause-title">DÉCIMA TERCERA [MODIFICACIONES Y ADENDAS]:</div>
            <p>Cualquier modificación a los términos, condiciones, alcances o tarifas de este contrato deberá constar por escrito mediante Adenda debidamente rubricada y suscrita por los representantes autorizados de ambas partes.</p>

            <div class="clause-title">DÉCIMA CUARTA [CONFIDENCIALIDAD]:</div>
            <p><strong>EL CONTRATISTA</strong> se obliga a guardar estricta confidencialidad respecto a toda la información técnica, comercial, listados de clientes, números de teléfono, direcciones domiciliares y procedimientos internos a los que tenga acceso en ocasión de la ejecución del presente contrato, no pudiendo revelarla ni emplearla para fines ajenos a la prestación del servicio.</p>

            <div class="clause-title">DÉCIMA QUINTA [AVISOS Y NOTIFICACIONES]:</div>
            <p>Todas las comunicaciones, avisos y notificaciones entre las partes se considerarán válidamente efectuadas en las siguientes direcciones:</p>
            <ul>
                <li><strong>EL CONTRATANTE:</strong> Oficinas de Centro de Servicios SINSA, Centro de Distribución (CEDI), Rotonda El Periodista 100 metros al Este, Managua, Nicaragua. Con Atención a: <strong>JOSE ALFREDO RAUDES ORTIZ / ÁNGEL CAMPOS</strong> (Tel: 7886-2226 / 8267-2246 - Correo: jose.raudes@sinsa.com.ni).</li>
                <li><strong>EL CONTRATISTA:</strong> ${nomCom}, con domicilio en ${dir}. Con Atención a: ${nomRep} (Tel: ${tel} - Correo Electrónico: ${correo}).</li>
            </ul>
            <p>Cualquier cambio de domicilio o datos de contacto deberá notificarse formalmente por escrito con al menos veinticuatro (24) horas de anticipación para que surta plenos efectos legales.</p>

            <div class="clause-title">DÉCIMA SEXTA [DOMICILIO CONTRACTUAL]:</div>
            <p>Para todos los efectos legales y judiciales derivados del presente contrato, las partes fijan de común acuerdo como domicilio especial y contractual la ciudad de Managua, República de Nicaragua.</p>

            <div class="clause-title">DÉCIMA SÉPTIMA [SOLUCIÓN DE CONTROVERSIAS]:</div>
            <p>Cualquier discrepancia, desavenencia o controversia que surja entre las partes en relación con la interpretación, ejecución o terminación del presente contrato, será sometida en primer lugar a un trámite de mediación y conciliación ante la Dirección de Resolución Alterna de Conflictos (DIRAC). Si transcurrido un plazo de diez (10) días hábiles las partes no alcanzaren un acuerdo conciliatorio satisfactorio, la controversia se ventilará ante los juzgados ordinarios competentes del departamento de Managua.</p>

            <div class="clause-title">DÉCIMA OCTAVA [EQUIPOS, HERRAMIENTAS E INSUMOS]:</div>
            <p><strong>EL CONTRATISTA</strong> suministrará a su propia costa todos los medios de transporte y movilización adecuados, así como las herramientas e instrumentos técnicos necesarios para la debida ejecución de los servicios (escaleras certificadas, bombas de vacío, manómetros digitales o análogos para refrigerantes R410A y R32, abocardadores excéntricos, llaves dinamométricas, amperímetros y multímetros). Cuando los materiales o repuestos de instalación sean provistos por <strong>EL CONTRATANTE</strong>, <strong>EL CONTRATISTA</strong> deberá retirarlos formalmente de las bodegas designadas presentando la orden respectiva.</p>

            <div class="clause-title">DÉCIMA NOVENA [ACEPTACIÓN]:</div>
            <p>Ambas partes declaran expresamente que conocen, entienden y aceptan todas y cada una de las cláusulas y estipulaciones contenidas en el presente contrato, encontrándolo redactado a entera conformidad y sin vicio alguno que pudiera invalidarlo, en fe de lo cual firmamos en dos (2) tantos de un mismo tenor y fuerza legal, en la ciudad de Managua, a los ${dia} días del mes de ${mes} del año ${anio}.</p>

            <table class="sig-table">
                <tr>
                    <td>
                        <div class="sig-bar">EL CONTRATANTE</div>
                        <div>Oscar René Vargas Reyes</div>
                        <div style="font-size: 8.5pt; color: #555555;">SILVA INTERNACIONAL S.A. (SINSA)</div>
                    </td>
                    <td>
                        <div class="sig-bar">EL CONTRATISTA</div>
                        <div>${nomRep}</div>
                        <div style="font-size: 8.5pt; color: #555555;">${nomCom}</div>
                    </td>
                </tr>
            </table>

            <br style="page-break-before: always;">
            ${logoHtml}
            <div style="text-align: center; font-weight: bold; font-size: 11pt; margin-top: 20pt; margin-bottom: 12pt;">
                ANEXO I: TABLA DE OFERTA Y TARIFAS DE SERVICIOS - ${nomCom}
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 20%; text-align: center;">CODIGO</th>
                        <th style="width: 55%; text-align: left;">DESCRIPCIÓN</th>
                        <th style="width: 25%; text-align: right;">PRECIO (C$)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword;charset=utf-8' });
    saveBlobAsFile(blob, `CONTRATO_SERVICIOS_${safeName}.doc`);
}

// Finalizar la vinculación y activar en pagos
async function finishProviderOnboarding() {
    const data = getWizardData();
    const provName = data.nombre_comercial.trim();

    if (!provName) {
        alert("El contratista debe tener al menos un Nombre Comercial o Razón Social.");
        return;
    }

    if (data.tarifas.length === 0) {
        alert("Debes configurar al menos una actividad con su tarifa para este contratista.");
        return;
    }

    data.estado = 'ACTIVO';
    data.progreso = 100;
    data.fecha_formalizacion = new Date().toLocaleDateString();
    if (!data.contrato_rubricado && wizardContratoRubricado) {
        data.contrato_rubricado = JSON.parse(JSON.stringify(wizardContratoRubricado));
    }
    data.estado_contrato = (data.contrato_rubricado && data.contrato_rubricado.fileName) ? 'RUBRICADO' : 'PENDIENTE_RUBRICA';

    // 1. Guardar en lista de proveedores registrados
    const existingIdx = proveedoresRegistrados.findIndex(p => (p.nombre_comercial || p.nombre || '').trim().toUpperCase() === provName.toUpperCase());
    if (existingIdx >= 0) {
        proveedoresRegistrados[existingIdx] = data;
    } else {
        proveedoresRegistrados.push(data);
    }

    safeSaveProvidersLocally(proveedoresRegistrados);

    // 2. Limpiar borrador temporal activo
    localStorage.removeItem(STORAGE_KEY_WIZARD_DRAFT);
    const banner = document.getElementById('wizard-draft-banner');
    if (banner) banner.classList.add('hidden');

    // 3. Intentar guardar en backend
    try {
        await fetch('/api/save-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.log("Guardado en almacenamiento local completado.");
    }

    // 4. SINCRONIZACIÓN INMEDIATA CON EL MOTOR DE PAGOS (tablaOferta)
    if (!tablaOferta[provName]) {
        tablaOferta[provName] = {};
    }

    data.tarifas.forEach(t => {
        if (t.descripcion) {
            tablaOferta[provName][t.descripcion.trim()] = parseFloat(t.tarifa) || 0;
        }
    });

    // Guardar tablaOferta actualizada
    saveAndRefresh();

    // 5. Seleccionar este proveedor en el Resumen de Pagos
    selectedProvider = provName;
    const initialSelect = document.getElementById('initial-provider-select');
    if (initialSelect) {
        initialSelect.value = provName;
    }
    updateProviderPricesTable();

    // 6. Notificación y cambio de pestaña
    alert(`🎉 ¡Proveedor "${provName}" formalizado y activado con éxito!\n\nSe han registrado ${data.tarifas.length} actividades y sus tarifas ya están habilitadas en el módulo de pagos.`);
    
    // Cambiar a la vista de Liquidación de Pagos
    switchModuleView('dashboard');
}

// ==========================================================================
// MÓDULO DE DIRECTORIO DE PROVEEDORES
// ==========================================================================

function initDirectoryModule() {
    document.getElementById('btn-go-to-onboarding')?.addEventListener('click', () => {
        resetWizardForm();
        switchModuleView('view-onboarding');
    });

    document.getElementById('directory-search')?.addEventListener('input', renderDirectory);
    document.getElementById('directory-regimen-filter')?.addEventListener('change', renderDirectory);
    document.getElementById('directory-status-filter')?.addEventListener('change', renderDirectory);
    document.getElementById('directory-contract-filter')?.addEventListener('change', renderDirectory);

    // Modales de expediente y tarifas
    document.getElementById('close-expediente')?.addEventListener('click', () => {
        document.getElementById('expediente-modal-overlay')?.classList.add('hidden');
    });
    document.getElementById('btn-close-expediente-bottom')?.addEventListener('click', () => {
        document.getElementById('expediente-modal-overlay')?.classList.add('hidden');
    });
    document.getElementById('close-edit-tarifas')?.addEventListener('click', () => {
        document.getElementById('edit-tarifas-modal-overlay')?.classList.add('hidden');
    });
    document.getElementById('btn-cancel-tarifas')?.addEventListener('click', () => {
        document.getElementById('edit-tarifas-modal-overlay')?.classList.add('hidden');
    });

    // Modal de Contrato Rubricado
    document.getElementById('close-rubricar-modal')?.addEventListener('click', () => {
        document.getElementById('rubricar-modal-overlay')?.classList.add('hidden');
    });
    document.getElementById('btn-cancel-rubricar')?.addEventListener('click', () => {
        document.getElementById('rubricar-modal-overlay')?.classList.add('hidden');
    });
    document.getElementById('btn-save-rubricar')?.addEventListener('click', saveRubricatedContractFromModal);
    document.getElementById('rubricar-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'rubricar-modal-overlay') {
            document.getElementById('rubricar-modal-overlay').classList.add('hidden');
        }
    });
}

function renderDirectory() {
    const grid = document.getElementById('directory-grid');
    if (!grid) return;

    const searchTerm = document.getElementById('directory-search')?.value.toLowerCase().trim() || '';
    const regimenFilter = document.getElementById('directory-regimen-filter')?.value || 'ALL';
    const statusFilter = document.getElementById('directory-status-filter')?.value || 'ALL';
    const contractFilter = document.getElementById('directory-contract-filter')?.value || 'ALL';

    grid.innerHTML = '';

    const filtered = proveedoresRegistrados.filter(p => {
        const nom = (p.nombre_comercial || p.nombre || '').toLowerCase();
        const rep = (p.nombre_representante || '').toLowerCase();
        const ruc = (p.ruc || p.cedula || '').toLowerCase();
        const reg = p.regimen || 'Régimen de Cuota Fija';
        const isDraft = p.estado === 'BORRADOR';
        const hasRubricado = !!(p.contrato_rubricado && p.contrato_rubricado.fileName);

        const matchesStatus = statusFilter === 'ALL' || 
                              (statusFilter === 'BORRADOR' && isDraft) || 
                              (statusFilter === 'ACTIVO' && !isDraft);

        const matchesContract = contractFilter === 'ALL' ||
                                (contractFilter === 'RUBRICADO' && hasRubricado) ||
                                (contractFilter === 'PENDIENTE' && !hasRubricado);

        const matchesSearch = !searchTerm || nom.includes(searchTerm) || rep.includes(searchTerm) || ruc.includes(searchTerm);
        const matchesRegimen = regimenFilter === 'ALL' || reg === regimenFilter;
        return matchesSearch && matchesRegimen && matchesStatus && matchesContract;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-panel); border: 1px dashed var(--glass-border); border-radius: 16px;">
                <span style="font-size: 2.5rem; display: block; margin-bottom: 0.8rem;">👥</span>
                <h4 style="color: var(--text-main);">No se encontraron proveedores</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 4px;">Utiliza el botón "➕ Vincular Nuevo Proveedor" para dar de alta a un contratista o continuar un borrador.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(prov => {
        const provName = prov.nombre_comercial || prov.nombre || 'Contratista';
        const repName = prov.nombre_representante || provName;
        const totalActs = (prov.tarifas && prov.tarifas.length) || (tablaOferta[provName] ? Object.keys(tablaOferta[provName]).length : 0);
        const fuelRate = prov.tarifa_combustible !== undefined ? prov.tarifa_combustible : 12.0;
        const isDraft = prov.estado === 'BORRADOR';
        const prog = prov.progreso !== undefined ? prov.progreso : (isDraft ? calculateOnboardingProgress(prov) : 100);
        const hasRubricado = !!(prov.contrato_rubricado && prov.contrato_rubricado.fileName);

        const card = document.createElement('div');
        card.className = 'directory-card';
        if (isDraft) {
            card.style.borderColor = 'rgba(245, 158, 11, 0.45)';
            card.style.background = 'linear-gradient(180deg, rgba(245, 158, 11, 0.04), var(--bg-panel))';
        }

        card.innerHTML = `
            <div>
                <div class="directory-card-header">
                    <div>
                        <div class="directory-prov-name">${provName}</div>
                        <div class="directory-prov-rep">👤 ${repName}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <span class="badge-tag" style="margin: 0; font-size: 0.7rem;">${prov.regimen || 'Cuota Fija'}</span>
                        <span class="badge-tag ${isDraft ? 'badge-draft' : 'badge-active'}" style="margin: 0; font-size: 0.7rem;">
                            ${isDraft ? `🟡 Borrador (${prog}%)` : '🟢 Activo'}
                        </span>
                        <span class="badge-tag ${hasRubricado ? 'badge-rubricated' : 'badge-legal-pending'}" style="margin: 0; font-size: 0.7rem;">
                            ${hasRubricado ? '✓ Rubricado' : '⏳ VoBo Legal Pendiente'}
                        </span>
                    </div>
                </div>

                ${isDraft ? `
                    <div style="margin: 0.6rem 0 0.8rem 0;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                            <span>Progreso de Documentación y Datos</span>
                            <span>${prog}%</span>
                        </div>
                        <div class="progress-bar-mini">
                            <div class="progress-bar-fill-mini" style="width: ${prog}%;"></div>
                        </div>
                    </div>
                ` : ''}

                <div class="directory-card-body">
                    <div class="directory-data-row">
                        <span class="directory-data-label">Cédula / RUC:</span>
                        <span class="directory-data-value">${prov.ruc || prov.cedula || '<em style="color:#DC2626;">Pendiente</em>'}</span>
                    </div>
                    <div class="directory-data-row">
                        <span class="directory-data-label">Cuenta Bancaria:</span>
                        <span class="directory-data-value">${prov.cuenta_bancaria ? `${prov.banco || 'BAC'} - ${prov.cuenta_bancaria}` : '<em style="color:#DC2626;">Pendiente</em>'}</span>
                    </div>
                    <div class="directory-data-row">
                        <span class="directory-data-label">Tarifas Acordadas:</span>
                        <span class="directory-data-value" style="color: var(--primary); font-weight: 700;">${totalActs} actividades</span>
                    </div>
                    <div class="directory-data-row">
                        <span class="directory-data-label">Tarifa Combustible:</span>
                        <span class="directory-data-value">C$ ${Number(fuelRate).toFixed(2)}/km</span>
                    </div>
                </div>
            </div>

            <div class="directory-card-actions">
                <div class="directory-actions-row">
                    <button class="btn btn-outline" data-dir-contract="${provName}" title="Descargar Borrador Word">📄 Borrador</button>
                    <button class="btn btn-outline" data-dir-compliance="${provName}" title="Descargar Ficha de Cumplimiento (.docx)" style="color: #059669; border-color: rgba(16, 185, 129, 0.5);">📋 Ficha</button>
                    <button class="btn btn-outline" data-dir-rubricar="${provName}" title="${hasRubricado ? 'Ver/Descargar Contrato Rubricado' : 'Subir Contrato Rubricado por Legal'}" style="${hasRubricado ? 'color: #059669; border-color: rgba(16, 185, 129, 0.5);' : 'color: var(--primary);'}">
                        ${hasRubricado ? '📜 Ver Rubricado' : '📤 Subir Rubricado'}
                    </button>
                    <button class="btn btn-outline" data-dir-exp="${provName}" title="Ver Documentos">📁 Expediente</button>
                    <button class="btn btn-outline" data-dir-tariffs="${provName}" title="Ver Tarifas">💲 Tarifas</button>
                    ${isDraft ? `<button class="btn btn-outline" data-dir-del="${provName}" title="Eliminar Borrador" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.4); flex: 0.5;">🗑️</button>` : ''}
                </div>
                ${isDraft ? `
                    <button class="btn directory-btn-resume" data-dir-resume="${provName}" title="Continuar llenando campos y recaudos pendientes">
                        <span>✏️</span> Continuar Registro (${prog}%)
                    </button>
                ` : `
                    <button class="btn directory-btn-pay" data-dir-pay="${provName}" title="Liquidar Pagos de Facturas">
                        <span>🧮</span> Liquidar Pagos
                    </button>
                `}
            </div>
        `;

        // Eventos de botones
        card.querySelector(`[data-dir-contract="${provName}"]`)?.addEventListener('click', () => {
            downloadContractForProvider(prov);
        });

        card.querySelector(`[data-dir-compliance="${provName}"]`)?.addEventListener('click', () => {
            downloadProviderComplianceDocx(prov);
        });

        card.querySelector(`[data-dir-rubricar="${provName}"]`)?.addEventListener('click', () => {
            openRubricarModal(prov);
        });

        card.querySelector(`[data-dir-exp="${provName}"]`)?.addEventListener('click', () => {
            openExpedienteModal(prov);
        });

        card.querySelector(`[data-dir-tariffs="${provName}"]`)?.addEventListener('click', () => {
            openTarifasModal(prov);
        });

        card.querySelector(`[data-dir-resume="${provName}"]`)?.addEventListener('click', () => {
            resumeProviderOnboarding(prov);
        });

        card.querySelector(`[data-dir-del="${provName}"]`)?.addEventListener('click', () => {
            deleteProviderDraft(provName);
        });

        card.querySelector(`[data-dir-pay="${provName}"]`)?.addEventListener('click', () => {
            selectedProvider = provName;
            const selectEl = document.getElementById('initial-provider-select');
            if (selectEl) selectEl.value = provName;
            updateProviderPricesTable();
            switchModuleView('dashboard');
        });

        grid.appendChild(card);
    });
}

// Descargar contrato para proveedor del directorio
async function downloadContractForProvider(prov) {
    // Si no tiene tarifas completas en su objeto, leer de tablaOferta
    let tarifas = prov.tarifas;
    if (!tarifas || tarifas.length === 0) {
        const acts = tablaOferta[prov.nombre_comercial || prov.nombre] || {};
        tarifas = Object.keys(acts).map(a => ({ rms: '', descripcion: a, tarifa: acts[a] }));
    }

    const payload = {
        ...prov,
        tarifas: tarifas,
        tarifa_combustible: prov.tarifa_combustible !== undefined ? prov.tarifa_combustible : 12.0
    };

    try {
        await downloadContractDocxFile(payload);
    } catch (e) {
        console.error("Error al descargar contrato:", e);
        alert("Error al descargar contrato: " + e.message);
    }
}

// Modal de Expediente Digital
function openExpedienteModal(prov) {
    const modal = document.getElementById('expediente-modal-overlay');
    const title = document.getElementById('expediente-title');
    const infoBar = document.getElementById('expediente-info-bar');
    const docsList = document.getElementById('expediente-docs-list');
    const dlBtn = document.getElementById('btn-expediente-download-contract');

    if (!modal) return;

    const provName = prov.nombre_comercial || prov.nombre;
    if (title) title.textContent = `📁 Expediente Digital: ${provName}`;

    if (infoBar) {
        infoBar.innerHTML = `
            <div><strong>Representante:</strong> ${prov.nombre_representante || provName}</div>
            <div><strong>RUC/Cédula:</strong> ${prov.ruc || prov.cedula || 'N/D'}</div>
            <div><strong>Régimen:</strong> ${prov.regimen || 'Cuota Fija'}</div>
            <div><strong>Cuenta:</strong> ${prov.banco || 'BAC'} ${prov.cuenta_bancaria || ''}</div>
        `;
    }

    const reqDocs = DOCS_BY_REGIMEN[prov.regimen] || DOCS_BY_REGIMEN["Régimen de Cuota Fija"];
    if (docsList) {
        docsList.innerHTML = '';
        const provDocs = prov.documentos || {};

        // 1. Tarjeta Especial: Contrato Formal Rubricado
        const rubricado = prov.contrato_rubricado;
        const hasRubricado = !!(rubricado && rubricado.fileName);

        const contractCard = document.createElement('div');
        contractCard.className = `doc-checklist-card ${hasRubricado ? 'card-rubricado completed' : ''}`;
        contractCard.style.marginBottom = '1rem';
        contractCard.innerHTML = `
            <div class="doc-card-top">
                <div style="flex: 1;">
                    <div class="doc-info-title" style="display: flex; align-items: center; gap: 0.4rem;">
                        <span>📜</span>
                        <strong>Contrato Marco de Servicios (Legal & Rúbricas)</strong>
                    </div>
                    <div class="doc-info-sub" style="margin-top: 3px;">
                        ${hasRubricado ? 
                            `<strong>${escapeHtml(rubricado.fileName)}</strong> (${rubricado.fileSize || 'N/D'}) • Registrado: ${rubricado.uploadDate || 'Previamente'}` : 
                            'Borrador generado por CalcPago. Pendiente de visto bueno legal y firma rubricada en cada hoja.'}
                    </div>
                    ${(hasRubricado && rubricado.observaciones) ? `
                        <div style="font-size: 0.78rem; color: #059669; margin-top: 4px;">
                            Dictamen Legal: <em>"${escapeHtml(rubricado.observaciones)}"</em>
                        </div>
                    ` : ''}
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <span class="status-badge ${hasRubricado ? 'uploaded' : 'pending'}">
                        ${hasRubricado ? '✓ Rubricado' : '⏳ Pendiente Rúbrica'}
                    </span>
                    <div style="display: flex; gap: 0.4rem; margin-top: 4px;">
                        ${hasRubricado ? `
                            <button type="button" class="btn btn-outline" id="btn-exp-view-rubricado" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; color: #059669; border-color: rgba(16,185,129,0.5);">
                                📥 Ver Rubricado
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-outline" id="btn-exp-manage-rubricado" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; color: var(--primary); border-color: var(--primary);">
                            ${hasRubricado ? '🔄 Reemplazar' : '📤 Subir Rubricado'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        docsList.appendChild(contractCard);

        setTimeout(() => {
            document.getElementById('btn-exp-view-rubricado')?.addEventListener('click', () => {
                viewOrDownloadRubricatedFile(rubricado);
            });
            document.getElementById('btn-exp-manage-rubricado')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                openRubricarModal(prov);
            });
        }, 50);

        // Subtítulo divisor
        const divider = document.createElement('div');
        divider.style.cssText = 'font-weight: 700; font-size: 0.85rem; color: var(--text-muted); margin: 0.8rem 0 0.4rem 0; border-top: 1px solid var(--glass-border); padding-top: 0.8rem;';
        divider.textContent = '📋 Requisitos Documentales del Expediente:';
        docsList.appendChild(divider);

        reqDocs.forEach(doc => {
            const docData = provDocs[doc.id] || {};
            const isNotReq = !!docData.notRequired;
            const hasDoc = !isNotReq && docData.validated;
            const isResolved = isNotReq || hasDoc;

            let badgeHtml = '';
            if (isNotReq) {
                badgeHtml = `<span class="status-badge not-required-badge">⚪ No Requerido</span>`;
            } else if (hasDoc) {
                badgeHtml = `<span class="status-badge uploaded">✓ En Expediente</span>`;
            } else {
                badgeHtml = `<span class="status-badge pending">Pendiente</span>`;
            }

            let detailHtml = '';
            if (isNotReq) {
                detailHtml = `⚪ Exonerado / No necesario${docData.justification ? ` — <em>${docData.justification}</em>` : ''}`;
            } else if (hasDoc) {
                detailHtml = `Archivo: ${docData.fileName || 'Digitalizado'}`;
            } else {
                detailHtml = 'Sin archivo adjunto';
            }

            const docItem = document.createElement('div');
            docItem.className = `doc-checklist-card ${hasDoc ? 'completed' : ''} ${isNotReq ? 'not-required' : ''}`;
            docItem.innerHTML = `
                <div class="doc-card-top">
                    <div>
                        <div class="doc-info-title">${doc.name}</div>
                        <div class="doc-info-sub">${doc.desc}</div>
                    </div>
                    ${badgeHtml}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.4rem;">
                    ${detailHtml}
                </div>
            `;
            docsList.appendChild(docItem);
        });
    }

    if (dlBtn) {
        dlBtn.onclick = () => downloadContractForProvider(prov);
    }

    const dlCompBtn = document.getElementById('btn-expediente-download-compliance');
    if (dlCompBtn) {
        dlCompBtn.onclick = () => downloadProviderComplianceDocx(prov);
    }

    modal.classList.remove('hidden');
}

// Modal de Gestión y Carga de Contrato Rubricado
let currentRubricarProvider = null;

function openRubricarModal(prov) {
    currentRubricarProvider = prov;
    const modal = document.getElementById('rubricar-modal-overlay');
    const title = document.getElementById('rubricar-modal-title');
    const statusBox = document.getElementById('rubricar-modal-current-status');
    const fileInput = document.getElementById('input-modal-rubricar');
    const notesText = document.getElementById('modal-rubricar-notes');

    if (!modal) return;

    const provName = prov.nombre_comercial || prov.nombre || 'Contratista';
    if (title) {
        title.textContent = `📜 Contrato Rubricado: ${provName}`;
    }

    if (fileInput) {
        fileInput.value = '';
    }

    const rubricado = prov.contrato_rubricado;
    const hasRubricado = !!(rubricado && rubricado.fileName);

    if (notesText) {
        notesText.value = (rubricado && rubricado.observaciones) ? rubricado.observaciones : '';
    }

    if (statusBox) {
        if (hasRubricado) {
            statusBox.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <div style="font-weight: 700; color: #059669; font-size: 0.88rem;">
                            ✓ Contrato Rubricado Registrado en Expediente
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                            <strong>${escapeHtml(rubricado.fileName)}</strong> (${rubricado.fileSize || 'N/D'}) • Subido: ${rubricado.uploadDate || 'Previamente'}
                        </div>
                    </div>
                    <div>
                        <button type="button" id="btn-modal-view-current-rubricado" class="btn btn-outline" style="font-size: 0.8rem; color: #059669; border-color: rgba(16, 185, 129, 0.5);">
                            📥 Ver Documento
                        </button>
                    </div>
                </div>
            `;
            setTimeout(() => {
                document.getElementById('btn-modal-view-current-rubricado')?.addEventListener('click', () => {
                    viewOrDownloadRubricatedFile(rubricado);
                });
            }, 50);
        } else {
            statusBox.innerHTML = `
                <div style="background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 0.85rem;">
                    <div style="font-weight: 600; color: #d97706; font-size: 0.88rem;">
                        ⏳ Estado Actual: Pendiente de Rúbrica / VoBo Legal
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">
                        Aún no se ha adjuntado el contrato rubricado por ambas partes. Seleccione a continuación el archivo final escaneado para incorporarlo formalmente a este expediente.
                    </div>
                </div>
            `;
        }
    }

    modal.classList.remove('hidden');
}

async function saveRubricatedContractFromModal() {
    if (!currentRubricarProvider) return;
    const fileInput = document.getElementById('input-modal-rubricar');
    const notesText = document.getElementById('modal-rubricar-notes');
    const notes = notesText ? notesText.value.trim() : '';

    const file = fileInput && fileInput.files && fileInput.files[0];

    const finalizeSave = async (fileRecord) => {
        const provName = currentRubricarProvider.nombre_comercial || currentRubricarProvider.nombre;
        const idx = proveedoresRegistrados.findIndex(p => 
            (p.nombre_comercial || p.nombre || '').trim().toUpperCase() === provName.trim().toUpperCase()
        );

        if (idx >= 0) {
            proveedoresRegistrados[idx].contrato_rubricado = fileRecord;
            proveedoresRegistrados[idx].estado_contrato = 'RUBRICADO';
            currentRubricarProvider = proveedoresRegistrados[idx];
        } else {
            currentRubricarProvider.contrato_rubricado = fileRecord;
            currentRubricarProvider.estado_contrato = 'RUBRICADO';
            proveedoresRegistrados.push(currentRubricarProvider);
        }

        safeSaveProvidersLocally(proveedoresRegistrados);

        try {
            await fetch('/api/save-provider', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentRubricarProvider)
            });
        } catch (e) {
            console.log("Guardado local completado.");
        }

        document.getElementById('rubricar-modal-overlay')?.classList.add('hidden');
        renderDirectory();
        alert(`📜 ¡Contrato rubricado de "${provName}" guardado exitosamente en el expediente!`);
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const fileRecord = {
                fileName: file.name,
                fileSize: formatFileSize(file.size),
                uploadDate: new Date().toLocaleString(),
                dataUrl: evt.target.result,
                observaciones: notes
            };
            await finalizeSave(fileRecord);
        };
        reader.readAsDataURL(file);
    } else {
        if (currentRubricarProvider.contrato_rubricado && currentRubricarProvider.contrato_rubricado.fileName) {
            const fileRecord = {
                ...currentRubricarProvider.contrato_rubricado,
                observaciones: notes
            };
            await finalizeSave(fileRecord);
        } else {
            alert("⚠️ Por favor seleccione el archivo digital (.pdf o .docx) del contrato rubricado.");
        }
    }
}

// Modal de Tarifas del Proveedor
let currentEditingTariffProvider = null;
function openTarifasModal(prov) {
    const modal = document.getElementById('edit-tarifas-modal-overlay');
    const title = document.getElementById('edit-tarifas-title');
    const tbody = document.getElementById('modal-tarifas-body');
    const fuelInput = document.getElementById('modal-fuel-rate');
    const countLabel = document.getElementById('edit-tarifas-count');

    if (!modal) return;

    currentEditingTariffProvider = prov;
    const provName = prov.nombre_comercial || prov.nombre;
    if (title) title.textContent = `💲 Tarifario: ${provName}`;

    // Obtener actividades de tablaOferta o del proveedor
    const acts = tablaOferta[provName] || {};
    let tList = [];
    if (prov.tarifas && prov.tarifas.length > 0) {
        tList = JSON.parse(JSON.stringify(prov.tarifas));
    } else {
        tList = Object.keys(acts).map(a => ({ rms: '', descripcion: a, tarifa: acts[a] }));
    }

    if (fuelInput) {
        fuelInput.value = (prov.tarifa_combustible !== undefined ? prov.tarifa_combustible : 12.0).toFixed(2);
    }

    function renderModalRows() {
        if (!tbody) return;
        tbody.innerHTML = '';
        if (countLabel) countLabel.textContent = `${tList.length} Actividades`;

        tList.forEach((item, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" class="custom-input" value="${item.rms || ''}" style="width: 100%; font-size: 0.82rem;" data-m-rms="${i}"></td>
                <td><input type="text" class="custom-input" value="${item.descripcion || ''}" style="width: 100%; font-size: 0.82rem;" data-m-desc="${i}"></td>
                <td><input type="number" class="custom-input" value="${item.tarifa || 0}" style="width: 100%; text-align: right; font-size: 0.82rem;" data-m-price="${i}"></td>
                <td style="text-align: center;"><button class="btn-icon" data-del-m="${i}" style="color: var(--danger);">✖</button></td>
            `;

            tr.querySelector(`[data-m-rms="${i}"]`)?.addEventListener('input', (e) => { tList[i].rms = e.target.value.trim(); });
            tr.querySelector(`[data-m-desc="${i}"]`)?.addEventListener('input', (e) => { tList[i].descripcion = e.target.value.trim(); });
            tr.querySelector(`[data-m-price="${i}"]`)?.addEventListener('input', (e) => { tList[i].tarifa = parseFloat(e.target.value) || 0; });
            tr.querySelector(`[data-del-m="${i}"]`)?.addEventListener('click', () => {
                tList.splice(i, 1);
                renderModalRows();
            });

            tbody.appendChild(tr);
        });
    }

    renderModalRows();

    document.getElementById('btn-add-modal-tariff')?.addEventListener('click', () => {
        tList.push({ rms: '', descripcion: 'NUEVA ACTIVIDAD', tarifa: 0 });
        renderModalRows();
    });

    const saveBtn = document.getElementById('btn-save-modal-tarifas');
    if (saveBtn) {
        saveBtn.onclick = () => {
            prov.tarifas = tList;
            prov.tarifa_combustible = parseFloat(fuelInput?.value) || 12.0;

            // Actualizar tablaOferta
            tablaOferta[provName] = {};
            tList.forEach(t => {
                if (t.descripcion) {
                    tablaOferta[provName][t.descripcion.trim()] = parseFloat(t.tarifa) || 0;
                }
            });

            saveAndRefresh();
            safeSaveProvidersLocally(proveedoresRegistrados);
            try {
                fetch('/api/save-provider', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(prov)
                }).catch(() => {});
            } catch(e){}
            renderDirectory();
            modal.classList.add('hidden');
            alert(`¡Tarifario de "${provName}" actualizado con éxito!`);
        };
    }

    modal.classList.remove('hidden');
}

