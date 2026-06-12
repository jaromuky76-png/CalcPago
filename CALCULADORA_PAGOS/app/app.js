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
        console.log("Tabla de Oferta cargada desde memoria", tablaOferta);
        updateInitialProviderSelect();
        updateManageProviderSelect();
    } else {
        setupOverlay.classList.remove('hidden');
    }
});

// -- Setup Modal Events --
btnConfig.addEventListener('click', () => setupOverlay.classList.remove('hidden'));
closeSetup.addEventListener('click', () => setupOverlay.classList.add('hidden'));

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
                        mes: fileMonth
                    });
                }
            }

            if (extracted.length === 0) {
                alert("No se encontraron actividades en el archivo de OT.");
                return;
            }

            currentOTData = currentOTData.concat(extracted);
            currentOTData.sort((a, b) => a.fechaObj - b.fechaObj);
            
            updateMonthFilter();
            
            // Si hay un proveedor seleccionado, mantenemos ese, si no, se queda en ALL
            const initialProviderSelect = document.getElementById('initial-provider-select');
            selectedProvider = initialProviderSelect.value || 'ALL';
            
            renderTable();
            calculateAndRenderSummary();
            updateProviderPricesTable(); // Update prices table under calc
            
        } catch (err) {
            console.error(err);
            alert("Error al procesar el Estado de OT: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

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

// Search functionality
document.getElementById('search-ot')?.addEventListener('input', (e) => {
    renderTable();
    calculateAndRenderSummary();
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

    const searchTerm = document.getElementById('search-ot')?.value.trim().toLowerCase() || '';
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

    filteredData.forEach(item => {
        const tr = document.createElement('tr');
        if (item.semana) {
            tr.classList.add(`row-sem${item.semana}`);
            tr.classList.add('row-validated');
        }

        tr.innerHTML = `
            <td>${item.orden}</td>
            <td>${item.fecha}</td>
            <td>${item.actividad}</td>
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
}

// Function for 'Homologación de Términos'
function findProviderPrice(actividadStr, providerPrices) {
    if (!providerPrices) return { price: 0, mappedName: actividadStr };
    
    const actUpper = actividadStr.toUpperCase();
    const providerKeys = Object.keys(providerPrices);
    
    // 1. Exact match
    if (providerPrices[actividadStr] !== undefined) {
        return { price: providerPrices[actividadStr], mappedName: actividadStr };
    }
    
    // 2. Custom Business Rules (Homologación de Términos)
    let bestKey = null;

    if (actUpper.includes('VISITA')) {
        if (actUpper.includes('WHATSAPP') || actUpper.includes('WHAT SAP')) {
            bestKey = providerKeys.find(k => k.toUpperCase().includes('WHATSAPP') || k.toUpperCase().includes('WHAT SAP'));
        } else {
            bestKey = providerKeys.find(k => k.toUpperCase().includes('VISITA A DOMICILIO') || k.toUpperCase() === 'VISITA');
        }
    }
    
    if (!bestKey && (actUpper.includes('DESINSTALACION') || actUpper.includes('DESINSTALACIÓN'))) {
        bestKey = providerKeys.find(k => k.toUpperCase().includes('DESINSTALACION') || k.toUpperCase().includes('DESINSTALACIÓN'));
    }
    
    if (!bestKey && (actUpper.includes('INSTALACION') || actUpper.includes('INSTALACIÓN'))) {
        bestKey = providerKeys.find(k => k.toUpperCase().includes('INSTALACION') || k.toUpperCase().includes('INSTALACIÓN'));
    }
    
    if (!bestKey && actUpper.includes('PUNTO ELECTRICO')) {
        bestKey = providerKeys.find(k => k.toUpperCase().includes('PUNTO ELECTRICO'));
    }

    if (bestKey) {
        return { price: providerPrices[bestKey], mappedName: bestKey };
    }

    // 3. Fallback partial match
    const keyMatch = providerKeys.find(k => actUpper.includes(k.toUpperCase()) || k.toUpperCase().includes(actUpper));
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

    const searchTerm = document.getElementById('search-ot')?.value.trim().toLowerCase() || '';
    const selectedMonth = document.getElementById('month-filter')?.value || 'ALL';

    const filteredData = currentOTData.filter(d => {
        if (selectedMonth !== 'ALL' && d.mes !== selectedMonth) return false;
        if (searchTerm !== '') {
            return d.orden.toLowerCase().includes(searchTerm);
        }
        return selectedProvider === 'ALL' || d.proveedor === selectedProvider;
    });

    let consolidatedByWeek = {
        1: { data: {}, total: 0, hasData: false },
        2: { data: {}, total: 0, hasData: false },
        3: { data: {}, total: 0, hasData: false },
        4: { data: {}, total: 0, hasData: false }
    };

    filteredData.forEach(item => {
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
            if (!providerExtras[selectedProvider]) providerExtras[selectedProvider] = {};
            if (!providerExtras[selectedProvider][selectedMonth]) providerExtras[selectedProvider][selectedMonth] = { 1: [], 2: [], 3: [], 4: [] };
            const weekExtras = providerExtras[selectedProvider][selectedMonth][w];
            
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
                    tbodyHTML += `
                        <tr>
                            <td>${act}</td>
                            <td style="text-align:center;">${row.cantidad}</td>
                            <td style="text-align:right;">C$${row.precioUnitario.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:600; color:var(--accent);">C$${row.total.toFixed(2)}</td>
                        </tr>
                    `;
                });

                let dedBodyHTML = '';
                let totalDeductions = 0;
                
                if (!providerDeductions[selectedProvider]) {
                    providerDeductions[selectedProvider] = { 1: [], 2: [], 3: [], 4: [] };
                }
                const weekDeds = providerDeductions[selectedProvider][w];
                
                if (weekDeds && weekDeds.length > 0) {
                    weekDeds.forEach((ded, idx) => {
                        // Multi-month support for deductions
                        if (ded.linkedId && selectedMonth !== 'ALL') {
                            const linkedItem = currentOTData.find(d => d.id === ded.linkedId);
                            if (linkedItem && linkedItem.mes !== selectedMonth) {
                                return; // Skip if it belongs to another month
                            }
                        }

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

                if (!providerFacturas[selectedProvider]) providerFacturas[selectedProvider] = {};
                if (!providerFacturas[selectedProvider][selectedMonth]) providerFacturas[selectedProvider][selectedMonth] = { 1: '', 2: '', 3: '', 4: '' };
                const currentFactura = providerFacturas[selectedProvider][selectedMonth][w] || '';

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
                        if (!providerExtras[selectedProvider]) providerExtras[selectedProvider] = {};
                        if (!providerExtras[selectedProvider][selectedMonth]) providerExtras[selectedProvider][selectedMonth] = { 1: [], 2: [], 3: [], 4: [] };
                        providerExtras[selectedProvider][selectedMonth][w].push({ fecha, orden, actividad, valor });
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
                    providerExtras[selectedProvider][selectedMonth][w].splice(idx, 1);
                    calculateAndRenderSummary();
                });
            });

            document.querySelectorAll('.invoice-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const w = parseInt(e.target.getAttribute('data-week'));
                    if (!providerFacturas[selectedProvider]) providerFacturas[selectedProvider] = {};
                    if (!providerFacturas[selectedProvider][selectedMonth]) providerFacturas[selectedProvider][selectedMonth] = { 1: '', 2: '', 3: '', 4: '' };
                    providerFacturas[selectedProvider][selectedMonth][w] = e.target.value;
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

function getOpSymbol(op) {
    switch(op) {
        case 'add': return '+';
        case 'subtract': return '-';
        case 'multiply': return '×';
        case 'divide': return '÷';
    }
    return '';
}

// -- Save / Load Progress --
document.getElementById('btn-save-progress')?.addEventListener('click', async () => {
    if (currentOTData.length === 0) {
        alert("No hay datos cargados para guardar.");
        return;
    }
    
    if (!selectedProvider || selectedProvider === 'ALL') {
        alert("Selecciona un Proveedor específico para guardar su progreso. El progreso se guarda por proveedor.");
        return;
    }

    const saveState = {};
    let savedCount = 0;
    currentOTData.forEach(item => {
        if (item.semana !== null && item.proveedor === selectedProvider) {
            const key = `${item.orden}_${item.mes}`;
            saveState[key] = item.semana;
            savedCount++;
        }
    });

    if (savedCount === 0) {
        alert(`No has marcado ninguna actividad como validada para el proveedor ${selectedProvider} aún.`);
        return;
    }

    const saveObj = {
        version: 3,
        validations: saveState,
        deductions: providerDeductions[selectedProvider] || { 1: [], 2: [], 3: [], 4: [] },
        extras: providerExtras[selectedProvider] || {},
        facturas: providerFacturas[selectedProvider] || {}
    };
    
    const jsonString = JSON.stringify(saveObj, null, 2);
    const defaultName = `Validacion_${selectedProvider.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('es-NI').replace(/\//g, '')}.json`;

    try {
        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{
                    description: 'Archivo JSON',
                    accept: {'application/json': ['.json']},
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            // alert("Archivo guardado exitosamente.");
        } else {
            // Fallback para navegadores antiguos
            const filename = prompt("Introduce un nombre para este archivo de guardado (sin la extensión .json):", defaultName.replace('.json', ''));
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

    if (!selectedProvider || selectedProvider === 'ALL') {
        alert("Por favor selecciona primero el proveedor al que pertenece este archivo guardado antes de cargarlo.");
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const saveObj = JSON.parse(event.target.result);
            let saveState = {};
            
            if (saveObj.version >= 2) {
                saveState = saveObj.validations;
                if (!providerDeductions[selectedProvider]) providerDeductions[selectedProvider] = { 1: [], 2: [], 3: [], 4: [] };
                providerDeductions[selectedProvider] = saveObj.deductions || { 1: [], 2: [], 3: [], 4: [] };
                
                if (saveObj.version >= 3) {
                    providerExtras[selectedProvider] = saveObj.extras || {};
                    providerFacturas[selectedProvider] = saveObj.facturas || {};
                }
            } else {
                saveState = saveObj; // v1 format
            }

            let restoredCount = 0;
            currentOTData.forEach(item => {
                // Solo restaurar de este proveedor para no mezclar
                if (item.proveedor === selectedProvider) {
                    const key = `${item.orden}_${item.mes}`;
                    if (saveState[key] !== undefined) {
                        item.semana = saveState[key];
                        restoredCount++;
                    } else if (saveState[item.orden] !== undefined) { // Backward compatibility
                        item.semana = saveState[item.orden];
                        restoredCount++;
                    }
                }
            });

            if (restoredCount > 0) {
                renderTable();
                calculateAndRenderSummary();
                alert(`¡Se restauraron ${restoredCount} validaciones con éxito!`);
            } else {
                alert("El archivo no contenía validaciones aplicables a las OT actuales.");
            }
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
    if (providerFacturas[selectedProvider] && providerFacturas[selectedProvider][selectedMonth] && providerFacturas[selectedProvider][selectedMonth][targetWeek]) {
        invoiceNum = providerFacturas[selectedProvider][selectedMonth][targetWeek];
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
    if (providerExtras[selectedProvider] && providerExtras[selectedProvider][selectedMonth] && providerExtras[selectedProvider][selectedMonth][targetWeek]) {
        const weekExtras = providerExtras[selectedProvider][selectedMonth][targetWeek];
        weekExtras.forEach(extra => {
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
    if (providerExtras[selectedProvider] && providerExtras[selectedProvider][selectedMonth] && providerExtras[selectedProvider][selectedMonth][targetWeek]) {
        const weekExtras = providerExtras[selectedProvider][selectedMonth][targetWeek];
        weekExtras.forEach(extra => {
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
    
    // Signatures
    finalY = doc.lastAutoTable.finalY || finalY + 100;
    
    if(finalY > doc.internal.pageSize.height - 100) {
        doc.addPage();
        finalY = 50;
    }
    
    doc.setDrawColor(74, 85, 104);
    doc.line(80, finalY + 80, 250, finalY + 80);
    doc.setFontSize(11);
    doc.text("MAESTROS DE SINSA", 100, finalY + 95);
    
    doc.line(360, finalY + 80, 530, finalY + 80);
    doc.text(`PROVEEDOR: ${selectedProvider}`, 360, finalY + 95);
    
    doc.save(`Reporte_Validacion_${selectedProvider}_Semana_${targetWeek}.pdf`);
}

// -- Theme Toggle --
const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (btnThemeToggle) {
    const savedTheme = localStorage.getItem('calcPago_theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    btnThemeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('calcPago_theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('calcPago_theme', 'light');
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
    
    manualOverlay.classList.add('hidden');
    document.getElementById('manual-order').value = '';
});

document.getElementById('btn-clear-validations')?.addEventListener('click', () => {
    if(confirm("¿Seguro que deseas limpiar solo las VALIDACIONES (semanas marcadas y reclamos)?\n(El listado del Estado de OT se mantendrá para que puedas usarlo de nuevo)")) {
        if(currentOTData.length > 0) {
            currentOTData.forEach(item => item.semana = null);
        }
        providerDeductions = {};
        renderTable();
        calculateAndRenderSummary();
    }
});
