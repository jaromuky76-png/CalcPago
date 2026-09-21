// app.js

// State variables
let tablaOferta = {}; // Formato: { "GLOBAL AIR": { "Actividad 1": 100, ... }, "ENERGY": { ... } }
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

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const savedOferta = localStorage.getItem('calcPago_tablaOferta');
    if (savedOferta) {
        tablaOferta = JSON.parse(savedOferta);
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
                    fechaObj: d.fechaObj ? new Date(d.fechaObj) : new Date()
                }));
            }
            if (state.providerDeductions) providerDeductions = state.providerDeductions;
            if (state.providerFacturas) providerFacturas = state.providerFacturas;
            if (state.providerExtras) providerExtras = state.providerExtras;
            if (state.selectedProvider) selectedProvider = state.selectedProvider;

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
                const headerVal = headers[i];
                if(headerVal && headerVal !== 'NA' && headerVal !== 'N/A' && headerVal.length > 1) {
                    parsedData[headerVal] = {};
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
                if (!tablaOferta[provider]) {
                    tablaOferta[provider] = {};
                }
                Object.keys(parsedData[provider]).forEach(act => {
                    tablaOferta[provider][act] = parsedData[provider][act];
                });
            });
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
                const providerRaw = row[31] ? row[31].toString().toUpperCase().trim() : '';
                
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
let isRestoringDraft = false;
let autosaveTimer = null;
const STORAGE_KEY_WIZARD_DRAFT = 'calcPago_activeWizardDraft';
const STORAGE_KEY_PROVIDERS = 'calcPago_proveedoresRegistrados';

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

    renderWizardDocs();
    renderWizardTariffTable();

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

    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(proveedoresRegistrados));

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
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(proveedoresRegistrados));

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
                    const k = (sp.nombre_comercial || sp.nombre || '').trim().toUpperCase();
                    if (!proveedoresRegistrados.some(p => (p.nombre_comercial || p.nombre || '').trim().toUpperCase() === k)) {
                        proveedoresRegistrados.push(sp);
                    }
                });
            }
        }
    } catch (err) {
        console.log("Modo offline o servidor local sin API de proveedores activa.");
    }

    // 3. Si tablaOferta tiene proveedores que no están en el directorio, agregarlos como base
    Object.keys(tablaOferta).forEach(pName => {
        const k = pName.trim().toUpperCase();
        if (!proveedoresRegistrados.some(p => (p.nombre_comercial || p.nombre || '').trim().toUpperCase() === k)) {
            const acts = tablaOferta[pName] || {};
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
        documentos: wizardDocuments ? { ...wizardDocuments } : {}
    };
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
    const titularDisplay = data.titular_cuenta || repNameDisplay;
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
            <td colspan="2">TARIFA DE COMBUSTIBLE POR KM FUERA DEL RADIO DE LA CIUDAD</td>
            <td style="text-align: right; color: #00A859;">C$ ${Number(data.tarifa_combustible || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;

    viewer.innerHTML = `
        <div class="contract-header-title">
            CONTRATO DE SERVICIOS DE INSTALACIÓN DE AIRES ACONDICIONADOS
        </div>

        <p>
            Nosotros, <strong>OSCAR RENÉ VARGAS REYES</strong>, mayor de edad, casado, Master en Administración de Empresas, con domicilio en el municipio de Nindirí, departamento de Masaya, de tránsito por esta ciudad, titular de cédula de identidad nicaragüense, quien actúa en nombre y representación de la sociedad mercantil denominada <strong>SILVA INTERNACIONAL, SOCIEDAD ANÓNIMA (SINSA)</strong>, legalmente establecida conforme las leyes de la República de Nicaragua, según Testimonio de Escritura Pública número doce (12) de Constitución de Sociedad y Poder Especial de Representación número ciento noventa y dos (192), y que en lo sucesivo se denominará <strong>EL CONTRATANTE</strong>, y por otra parte, <strong>${data.nombre_representante ? data.nombre_representante.toUpperCase() : '<span class="missing-field-highlight">[PENDIENTE: REPRESENTANTE LEGAL]</span>'}</strong>, mayor de edad, ${(data.estado_civil || 'casado').toLowerCase()}, ${(data.profesion || 'técnico').toLowerCase()}, con domicilio en ${data.domicilio || 'Managua'}, titular de cédula de identidad nicaragüense número: ${data.cedula ? `<strong>${data.cedula}</strong>` : '<span class="missing-field-highlight">[PENDIENTE: CÉDULA]</span>'}${data.ruc ? ` y cédula RUC: <strong>${data.ruc}</strong>` : ''}, quien actúa en nombre e interés de negocio bajo ${data.regimen} denominado <strong>${data.nombre_comercial ? data.nombre_comercial.toUpperCase() : '<span class="missing-field-highlight">[PENDIENTE: NOMBRE COMERCIAL]</span>'}</strong>, quien en adelante se denominará <strong>EL CONTRATISTA</strong>, ambas partes de común acuerdo convenimos en celebrar el siguiente:
        </p>

        <p style="text-align: center; font-weight: bold; margin: 1.2rem 0;">
            CONTRATO DE SERVICIOS TERCERIZADOS DE INSTALACIÓN DE AIRES ACONDICIONADOS
        </p>

        <div class="contract-clause-title">PRIMERA [OBJETO DEL CONTRATO]:</div>
        <p>El presente contrato tiene por objeto la prestación del servicio de instalación de equipos de aire acondicionado, incluyendo la colocación, conexión eléctrica, pruebas de funcionamiento y puesta en marcha de los sistemas, conforme a las especificaciones técnicas y condiciones establecidas por el CLIENTE. El CONTRATISTA se obliga a realizar dichos trabajos con personal calificado, utilizando materiales y herramientas adecuadas, garantizando la correcta instalación y funcionamiento.</p>

        <div class="contract-clause-title">SEGUNDA [ALCANCES DEL CONTRATO]:</div>
        <p>Los alcances de los trabajos a realizar por EL CONTRATISTA estarán sujetos a visitar el local previamente indicado, determinar la lista de insumos y materiales requeridos, y realizar la instalación y mantenimientos en residencias o comercios programados por EL CONTRATANTE.</p>

        <div class="contract-clause-title">TERCERA [DOCUMENTOS INTEGRALES DEL CONTRATO]:</div>
        <p>Forman parte integral del presente contrato los siguientes documentos: Anexo de tarifas de instalación y combustible, Órdenes de Compra aprobadas, Órdenes de Trabajo de levantamiento de visita, Actas de Recepción final firmadas por el cliente receptor, y Facturas comerciales por cada prestación brindada.</p>

        <div class="contract-clause-title">CUARTA [OBLIGACIONES DEL CONTRATISTA]:</div>
        <p>Portar debidamente el uniforme de Maestros o Centro de Servicios, llevar a cabo las instalaciones con los más altos estándares de calidad, reportar incidencias inmediatas en ruta, y asumir los costos por reclamos atribuibles a mala instalación o fallas de mano de obra en garantía.</p>

        <div class="contract-clause-title">QUINTA [RESPONSABILIDAD EN MATERIA DE HIGIENE Y SEGURIDAD OCUPACIONAL]:</div>
        <p>EL CONTRATISTA se obliga a cumplir de manera estricta con todas las disposiciones de la Ley N.º 618 "Ley General de Higiene y Seguridad del Trabajo", garantizando que todo el personal involucrado cuente con certificaciones médicas ocupacionales vigentes, certificación para trabajos en altura mayores a 1.80 metros, acreditación técnica en seguridad eléctrica, y el uso permanente de Equipos de Protección Personal (EPP).</p>

        <div class="contract-clause-title">SEXTA [PLAZO]:</div>
        <p>El plazo de este contrato es de DOCE (12) meses contados a partir de su firma, prorrogable automáticamente por períodos iguales salvo notificación escrita en contrario con 30 días de anticipación.</p>

        <div class="contract-clause-title">SÉPTIMA [VALOR DEL CONTRATO Y FORMA DE PAGO]:</div>
        <p>Las partes acuerdan que el valor de los servicios estará regido por las tarifas detalladas en el Anexo I. Previa validación semanal de las órdenes de trabajo realizadas y facturación correspondiente con retenciones de ley aplicadas, los pagos serán realizados mediante transferencia bancaria a la cuenta de <strong>${(data.banco || 'BAC Credomatic').toUpperCase()}</strong> número: ${data.cuenta_bancaria ? `<strong>${data.cuenta_bancaria}</strong>` : '<span class="missing-field-highlight">[PENDIENTE: CUENTA BANCARIA]</span>'} en moneda córdobas a nombre de ${titularDisplay}.</p>

        <div class="contract-clause-title">OCTAVA [MANTENIMIENTO DE VALOR]:</div>
        <p>Se reconoce la cláusula de mantenimiento de valor en córdobas conforme al tipo de cambio oficial emitido por el Banco Central de Nicaragua al día del pago efectivo (Art. 38, Ley 732).</p>

        <div class="contract-clause-title">NOVENA [NATURALEZA DE LA RELACIÓN Y SEGURIDAD SOCIAL]:</div>
        <p>La relación es estrictamente civil y no genera vínculo laboral ni prestaciones sociales entre las partes. EL CONTRATISTA se compromete a mantener a su personal afiliado al Instituto Nicaragüense de Seguridad Social (INSS) y al día con sus contribuciones.</p>

        <div class="contract-clause-title">DÉCIMA A DÉCIMA SEXTA [CONDICIONES TÉCNICAS, GARANTÍA Y CONFIDENCIALIDAD]:</div>
        <p>El CONTRATISTA garantiza vicios ocultos de las instalaciones por el término de un (1) año tras la firma del acta de entrega final. En caso de atrasos injustificados, se establece una penalización del 1.25% diario hasta un máximo de 8 días. El contrato no podrá ser cedido sin autorización escrita.</p>

        <div class="contract-clause-title">DÉCIMA SÉPTIMA [AVISOS Y NOTIFICACIONES]:</div>
        <p>
            <strong>CONTRATANTE:</strong> Oficinas Centro de Servicios SINSA, Centro de Distribución, Rotonda El Periodista 100m al este, Managua. Atención: Jose Raudes / Ángel Campos (Tel: 78862226 / 82672246 - jose.raudes@sinsa.com.ni).<br>
            <strong>CONTRATISTA:</strong> ${data.nombre_comercial ? data.nombre_comercial.toUpperCase() : '<span class="missing-field-highlight">[PENDIENTE: NOMBRE COMERCIAL]</span>'}, ${direccionDisplay}. Atención: ${repNameDisplay} (Tel: ${telefonoDisplay} - ${correoDisplay}).
        </p>

        <div class="contract-clause-title">DÉCIMA OCTAVA A VIGÉSIMA [SOLUCIÓN DE CONTROVERSIAS Y ACEPTACIÓN]:</div>
        <p>En caso de controversias, las partes acudirán en primera instancia ante la Dirección de Resolución Alterna de Conflictos (DIRAC). Se prohíbe terminantemente la contratación o participación de menores de edad.</p>

        <p style="margin-top: 1.5rem;">
            En fe de lo cual firmamos el presente contrato, en dos tantos de un mismo tenor, en la ciudad de Managua, a los ${data.dia} días del mes de ${data.mes} del año ${data.anio}.
        </p>

        <div class="contract-signatures-grid">
            <div>
                <div class="contract-sig-line">EL CONTRATANTE</div>
                <div>Oscar René Vargas Reyes</div>
                <div style="font-size: 0.85rem; color: #4B5563;">SILVA INTERNACIONAL S.A. (SINSA)</div>
            </div>
            <div>
                <div class="contract-sig-line">EL CONTRATISTA</div>
                <div>${data.nombre_representante || '<span class="missing-field-highlight">[PENDIENTE: REPRESENTANTE]</span>'}</div>
                <div style="font-size: 0.85rem; color: #4B5563;">${data.nombre_comercial || '<span class="missing-field-highlight">[PENDIENTE: NOMBRE COMERCIAL]</span>'}</div>
            </div>
        </div>

        <div style="page-break-before: always; margin-top: 3rem; border-top: 2px dashed #94A3B8; padding-top: 2rem;">
            <div style="text-align: center; font-weight: bold; font-size: 1.1rem; margin-bottom: 1rem;">
                ANEXO I: TABLA DE OFERTA Y TARIFAS DE SERVICIOS
            </div>
            <table class="contract-annex-table">
                <thead>
                    <tr>
                        <th style="width: 150px; text-align: center;">RMS</th>
                        <th>DESCRIPCIÓN DE LA ACTIVIDAD</th>
                        <th style="width: 170px; text-align: right;">TARIFA (C$)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

// Descargar el Contrato en Word (.docx con fallback client-side)
async function downloadContractDocx() {
    const data = getWizardData();
    const btn = document.getElementById('btn-download-contract-docx');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '⏳ Generando archivo...';

    try {
        const response = await fetch('/api/generate-contract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = data.nombre_comercial.replace(/[^a-zA-Z0-9_-]/g, '_');
            a.download = `CONTRATO_SERVICIOS_${safeName}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            return;
        }
    } catch (err) {
        console.log("Servidor backend no disponible o en entorno estático. Generando documento en el navegador...");
    } finally {
        if (btn) btn.innerHTML = originalText;
    }

    // Fallback: Descarga directa generada en el navegador (funciona 100% en Render Web)
    downloadClientSideContractDoc(data);
}

function downloadClientSideContractDoc(data) {
    const safeName = (data.nombre_comercial || data.nombre || 'PROVEEDOR').replace(/[^a-zA-Z0-9_-]/g, '_');
    
    let tableRowsHtml = '';
    (data.tarifas || []).forEach(t => {
        tableRowsHtml += `
            <tr>
                <td style="text-align: center; border: 1pt solid #000000; padding: 4pt 6pt;">${t.rms || '-'}</td>
                <td style="border: 1pt solid #000000; padding: 4pt 6pt;">${t.descripcion}</td>
                <td style="text-align: right; font-weight: bold; border: 1pt solid #000000; padding: 4pt 6pt;">C$ ${Number(t.tarifa || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    tableRowsHtml += `
        <tr style="background-color: #F1F5F9; font-weight: bold;">
            <td colspan="2" style="border: 1pt solid #000000; padding: 4pt 6pt;">TARIFA DE COMBUSTIBLE POR KM FUERA DEL RADIO DE LA CIUDAD</td>
            <td style="text-align: right; border: 1pt solid #000000; padding: 4pt 6pt;">C$ ${Number(data.tarifa_combustible || 12.0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;

    const wordContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>CONTRATO DE SERVICIOS - ${data.nombre_comercial}</title>
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
                @page { size: 8.5in 11in; margin: 1in; mso-header-margin: 0.5in; mso-footer-margin: 0.5in; }
                body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #000000; text-align: justify; }
                h1 { text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 18pt; text-transform: uppercase; }
                .clause-title { font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; }
                table { width: 100%; border-collapse: collapse; margin-top: 12pt; margin-bottom: 12pt; font-size: 9pt; }
                th { background-color: #1E293B; color: #FFFFFF; font-weight: bold; border: 1pt solid #000000; padding: 5pt; }
                .sig-table { width: 100%; border: none; margin-top: 40pt; }
                .sig-table td { width: 50%; border: none; text-align: center; vertical-align: top; }
                .sig-bar { border-top: 1pt solid #000000; width: 75%; margin: 0 auto; padding-top: 4pt; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>CONTRATO DE SERVICIOS DE INSTALACIÓN DE AIRES ACONDICIONADOS</h1>
            <p>Nosotros, <strong>OSCAR RENÉ VARGAS REYES</strong>, mayor de edad, casado, Master en Administración de Empresas, con domicilio en el municipio de Nindirí, departamento de Masaya, de tránsito por esta ciudad, titular de cédula de identidad nicaragüense, quien actúa en nombre y representación de la sociedad mercantil denominada <strong>SILVA INTERNACIONAL, SOCIEDAD ANÓNIMA (SINSA)</strong>, legalmente establecida conforme las leyes de la República de Nicaragua, lo que demuestra con los siguientes documentos habilitantes: a) Testimonio de escritura pública número doce (12) de Constitución de Sociedad Anónima y Estatutos y b) Testimonio de escritura pública número ciento noventa y dos (192), denominada Poder Especial de Representación, y que en lo sucesivo se denominará <strong>EL CONTRATANTE</strong>, y por otra parte, <strong>${(data.nombre_representante || data.nombre || '').toUpperCase()}</strong>, mayor de edad, ${(data.estado_civil || 'casado').toLowerCase()}, ${(data.profesion || 'comerciante').toLowerCase()}, con domicilio en ${data.domicilio || 'Managua'}, titular de cédula de identidad nicaragüense número: <strong>${data.cedula || ''}</strong>${data.ruc ? ` y cédula RUC: <strong>${data.ruc}</strong>` : ''}, quien actúa en nombre e interés de negocio bajo ${data.regimen || 'Régimen de Cuota Fija'} denominado <strong>${(data.nombre_comercial || data.nombre || '').toUpperCase()}</strong>, quien en adelante se denominará <strong>EL CONTRATISTA</strong>, ambas partes de común acuerdo convenimos en celebrar el siguiente:</p>
            
            <p style="text-align: center; font-weight: bold; margin: 15pt 0;">CONTRATO DE SERVICIOS TERCERIZADOS DE INSTALACIÓN DE AIRES ACONDICIONADOS</p>

            <div class="clause-title">PRIMERA [OBJETO DEL CONTRATO]:</div>
            <p>El presente contrato tiene por objeto la prestación del servicio de instalación de equipos de aire acondicionado, incluyendo la colocación, conexión eléctrica, pruebas de funcionamiento y puesta en marcha de los sistemas, conforme a las especificaciones técnicas y condiciones establecidas por el CLIENTE.</p>

            <div class="clause-title">SEGUNDA [ALCANCES DEL CONTRATO]:</div>
            <p>Los alcances de los trabajos a realizar por EL CONTRATISTA estarán sujeto a las siguientes: Visitar el local previamente indicado por EL CONTRATANTE, proporcionar la lista de materiales necesarios, y realizar la instalación de aires acondicionados en residencias o locales programados por EL CONTRATANTE.</p>

            <div class="clause-title">TERCERA [DOCUMENTOS INTEGRALES DEL CONTRATO]:</div>
            <p>Forman parte integral del presente contrato los siguientes documentos: Anexo de tarifas de instalación y combustible, Órdenes de Compras aprobadas, Órdenes de Trabajo de levantamiento de visita, Actas de Recepción final firmadas por el cliente receptor, y Facturas por cada prestación de servicio brindada.</p>

            <div class="clause-title">CUARTA [OBLIGACIONES DEL CONTRATISTA]:</div>
            <p>Portar uniforme de Maestros o de Centro de Servicios garantizando la limpieza y cuidado de estos, llevar a cabo instalaciones de calidad respetando las normas de los fabricantes, reportar incidencias en ruta y asumir los costos por reclamos atribuibles a mala instalación.</p>

            <div class="clause-title">QUINTA [RESPONSABILIDAD EN MATERIA DE HIGIENE Y SEGURIDAD OCUPACIONAL]:</div>
            <p>EL CONTRATISTA se obliga a cumplir de manera estricta con todas las disposiciones de la Ley N.º 618 "Ley General de Higiene y Seguridad del Trabajo", garantizando certificaciones médicas ocupacionales vigentes, certificación para trabajos en altura superior a 1.80 metros, acreditación técnica en seguridad eléctrica, y el uso permanente de Equipos de Protección Personal (EPP).</p>

            <div class="clause-title">SEXTA [PLAZO]:</div>
            <p>El plazo de este contrato es de DOCE (12) meses contados a partir de la firma del contrato, prorrogable automáticamente por sucesivos períodos de igual vigencia salvo notificación contraria con 30 días de anticipación.</p>

            <div class="clause-title">SÉPTIMA [VALOR DEL CONTRATO Y FORMA DE PAGO]:</div>
            <p>Las partes acuerdan que el valor del presente contrato estará debidamente detallado de acuerdo a las actividades ampliamente descritas en el Anexo. Previa validación semanal de los servicios realizados y emisión de factura con las retenciones de ley, los pagos serán realizados mediante transferencia bancaria a la cuenta de <strong>${(data.banco || 'BANCO').toUpperCase()}</strong> número: <strong>${data.cuenta_bancaria || 'XXXXXXXXXXX'}</strong> en moneda córdobas a nombre de <strong>${(data.titular_cuenta || data.nombre_representante || '').toUpperCase()}</strong>.</p>

            <div class="clause-title">OCTAVA [MANTENIMIENTO DE VALOR]:</div>
            <p>Se reconoce la cláusula de mantenimiento de valor en córdobas conforme al tipo de cambio oficial del Banco Central de Nicaragua (Art. 38, Ley 732).</p>

            <div class="clause-title">NOVENA [NATURALEZA DE LA RELACIÓN Y SEGURIDAD SOCIAL]:</div>
            <p>La relación es estrictamente civil y no genera vínculo laboral ni prestaciones sociales. EL CONTRATISTA se compromete a que todo su personal esté afiliado al Instituto Nicaragüense de Seguridad Social (INSS) durante la vigencia del contrato.</p>

            <div class="clause-title">DÉCIMA A DÉCIMA SEXTA [CONDICIONES TÉCNICAS, GARANTÍA Y CONFIDENCIALIDAD]:</div>
            <p>El CONTRATISTA garantiza vicios ocultos por el término de un (1) año tras la firma del acta de recepción final. Se establece una multa del 1.25% por cada día de atraso hasta acumular un máximo de 8 días. El contrato no podrá ser cedido sin consentimiento previo por escrito.</p>

            <div class="clause-title">DÉCIMA SÉPTIMA [AVISOS Y NOTIFICACIONES]:</div>
            <p>
                <strong>CONTRATANTE:</strong> Oficinas de Centro de Servicios SINSA ubicadas en edificio Centro de distribución, rotonda el periodista 100m al este, Managua. Con Atención a: Jose Raudes, Ángel Campos (Tel: 78862226 / 82672246 - jose.raudes@sinsa.com.ni).<br>
                <strong>CONTRATISTA:</strong> ${(data.nombre_comercial || data.nombre || '').toUpperCase()}, ${data.direccion || 'Managua, Nicaragua'}. Con Atención a: ${data.nombre_representante || data.nombre || ''} (Tel: ${data.telefono || ''} - ${data.correo || ''}).
            </p>

            <div class="clause-title">DÉCIMA OCTAVA A VIGÉSIMA [SOLUCIÓN DE CONTROVERSIAS Y ACEPTACIÓN]:</div>
            <p>En caso de controversias las partes acudirán ante mediador de la Dirección de Resolución Alterna de Conflictos (DIRAC) de Managua. Se prohíbe terminantemente la contratación o participación de menores de edad.</p>

            <p style="margin-top: 15pt;">En fe de lo cual firmamos el presente contrato, en dos tantos de un mismo tenor, en la ciudad de Managua, a los ${data.dia || 23} días del mes de ${data.mes || 'octubre'} del año ${data.anio || 2026}.</p>

            <table class="sig-table">
                <tr>
                    <td>
                        <div class="sig-bar">EL CONTRATANTE</div>
                        <div>Oscar René Vargas Reyes</div>
                        <div style="font-size: 8pt; color: #555555;">SILVA INTERNACIONAL, S.A. (SINSA)</div>
                    </td>
                    <td>
                        <div class="sig-bar">EL CONTRATISTA</div>
                        <div>${data.nombre_representante || data.nombre || ''}</div>
                        <div style="font-size: 8pt; color: #555555;">${data.nombre_comercial || data.nombre || ''}</div>
                    </td>
                </tr>
            </table>

            <br style="page-break-before: always;">
            <div style="text-align: center; font-weight: bold; font-size: 11pt; margin-top: 20pt; margin-bottom: 10pt;">
                ANEXO I: TABLA DE OFERTA Y TARIFAS DE SERVICIOS - ${(data.nombre_comercial || data.nombre || '').toUpperCase()}
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 20%; text-align: center;">RMS</th>
                        <th style="width: 55%; text-align: left;">DESCRIPCIÓN DE LA ACTIVIDAD</th>
                        <th style="width: 25%; text-align: right;">TARIFA (C$)</th>
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CONTRATO_SERVICIOS_${safeName}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

    // 1. Guardar en lista de proveedores registrados
    const existingIdx = proveedoresRegistrados.findIndex(p => (p.nombre_comercial || p.nombre || '').trim().toUpperCase() === provName.toUpperCase());
    if (existingIdx >= 0) {
        proveedoresRegistrados[existingIdx] = data;
    } else {
        proveedoresRegistrados.push(data);
    }

    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(proveedoresRegistrados));

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
}

function renderDirectory() {
    const grid = document.getElementById('directory-grid');
    if (!grid) return;

    const searchTerm = document.getElementById('directory-search')?.value.toLowerCase().trim() || '';
    const regimenFilter = document.getElementById('directory-regimen-filter')?.value || 'ALL';
    const statusFilter = document.getElementById('directory-status-filter')?.value || 'ALL';

    grid.innerHTML = '';

    const filtered = proveedoresRegistrados.filter(p => {
        const nom = (p.nombre_comercial || p.nombre || '').toLowerCase();
        const rep = (p.nombre_representante || '').toLowerCase();
        const ruc = (p.ruc || p.cedula || '').toLowerCase();
        const reg = p.regimen || 'Régimen de Cuota Fija';
        const isDraft = p.estado === 'BORRADOR';
        const matchesStatus = statusFilter === 'ALL' || 
                              (statusFilter === 'BORRADOR' && isDraft) || 
                              (statusFilter === 'ACTIVO' && !isDraft);

        const matchesSearch = !searchTerm || nom.includes(searchTerm) || rep.includes(searchTerm) || ruc.includes(searchTerm);
        const matchesRegimen = regimenFilter === 'ALL' || reg === regimenFilter;
        return matchesSearch && matchesRegimen && matchesStatus;
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
                    <button class="btn btn-outline" data-dir-contract="${provName}" title="Descargar Contrato Word">📄 Contrato</button>
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
        const response = await fetch('/api/generate-contract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("No se pudo generar el contrato Word.");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (prov.nombre_comercial || prov.nombre).replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `CONTRATO_SERVICIOS_${safeName}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (e) {
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

    modal.classList.remove('hidden');
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
            localStorage.setItem('calcPago_proveedoresRegistrados', JSON.stringify(proveedoresRegistrados));
            renderDirectory();
            modal.classList.add('hidden');
            alert(`¡Tarifario de "${provName}" actualizado con éxito!`);
        };
    }

    modal.classList.remove('hidden');
}

