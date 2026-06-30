document.addEventListener('DOMContentLoaded', () => {
    
    // Core Elements
    const grid = document.getElementById('inventoryGrid');
    const searchInput = document.getElementById('searchInput');
    const catDropdown = document.getElementById('categoryDropdown');
    const catGrid = document.getElementById('categoryGrid');
    const totalCount = document.getElementById('totalCount');
    const emptyState = document.getElementById('emptyState');
    
    const updateDate = document.getElementById('updateDate');
    const dlExcelBtn = document.getElementById('dlExcel');
    const dlPdfBtn = document.getElementById('dlPdf');
    
    // Cart Elements
    const cartToggle = document.getElementById('cartBtn');
    const cartCount = document.getElementById('cartCount');
    const cartPanel = document.getElementById('cartPanel');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartContent = document.getElementById('cartContent');
    
    // Export Buttons
    const emailCart = document.getElementById('emailCart');
    const pdfCart = document.getElementById('pdfCart');
    const excelCart = document.getElementById('excelCart');
    const cartGrandTotalEl = document.getElementById('cartGrandTotal');
    const cartActions = document.getElementById('cartActions');
    const clearCartBtn = document.getElementById('clearCartBtn');

    const sortSelect = document.getElementById('sortSelect');
    
    // Modal Elements
    const imageModal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    const modalCaption = document.getElementById('modalCaption');
    const closeModal = document.getElementById('closeModal');
    
    // Sort logic
    let currentSort = 'default';

    // Initialization
    let inventory = [];
    let originalInventoryOrder = []; // Store to support "Newest" or "Default"
    let categoriesList = {}; // { Parent: Set(Subcategories) }
    let currentCategory = 'All Categories';
    let currentParentCategory = 'All Parents';
    let currentSearch = '';

    // Selection state: map of itemId -> { item, quantity }
    let selectionCart = JSON.parse(localStorage.getItem('casaCentralSelectionCart')) || {};

    // Fixed Tax Rate Constant (3.3125%)
    const TAX_RATE = 0.033125;

    // Boot Up
    loadData();

    async function loadData() {
        try {
            const response = await fetch('./data/inventory.json?t=' + new Date().getTime());
            if (!response.ok) throw new Error('Network response error');
            const data = await response.json();
            
            inventory = data.items;
            originalInventoryOrder = [...data.items];
            
            // Meta updates
            updateDate.textContent = data.last_updated || "Live";
            if(data.downloads && data.downloads.excel) { dlExcelBtn.href = data.downloads.excel; } else if (dlExcelBtn) { dlExcelBtn.style.display = 'none'; }
            if(data.downloads && data.downloads.pdf) { dlPdfBtn.href = data.downloads.pdf; } else if (dlPdfBtn) { dlPdfBtn.style.display = 'none'; }
            
            inventory.forEach(item => {
                let p = item.parent_category || "Other";
                let s = item.sub_category || item.category || "Uncategorized";
                if(!categoriesList[p]) categoriesList[p] = new Set();
                categoriesList[p].add(s);
            });
            
            grid.innerHTML = '';
            buildFilters();
            renderGrid();
            updateCartUI(); // Initial UI sync
        } catch (error) {
            totalCount.textContent = "Error loading inventory data.";
            console.error('Fetch error:', error);
        }
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderGrid();
        });
    }

    function buildFilters() {
        if (!catDropdown || !catGrid) return;
        catDropdown.innerHTML = '<option value="All Categories">All Categories</option>';
        catGrid.innerHTML = '';
        
        // "All Inventory" root button
        const allBtn = document.createElement('button');
        allBtn.className = 'btn-parent-cat active-parent';
        allBtn.textContent = 'All Inventory';
        allBtn.addEventListener('click', () => selectCategory('All Parents', 'All Categories'));
        catGrid.appendChild(allBtn);
        
        Object.keys(categoriesList).sort().forEach(parent => {
            if (parent === 'Other') return;
            // Dropdown optgroup
            const group = document.createElement('optgroup');
            group.label = parent;

            // Accordion wrapper
            const wrap = document.createElement('div');
            wrap.className = 'parent-cat-wrap';

            const btnP = document.createElement('button');
            btnP.className = 'btn-parent-cat';
            btnP.dataset.parent = parent;
            btnP.innerHTML = `<span>${parent}</span><span class="arrow">▶</span>`;

            const subGrid = document.createElement('div');
            subGrid.className = 'sub-cat-grid';

            btnP.addEventListener('click', () => {
                const isOpen = subGrid.classList.contains('open');
                // Close all open accordions first
                document.querySelectorAll('.sub-cat-grid.open').forEach(g => g.classList.remove('open'));
                document.querySelectorAll('.btn-parent-cat .arrow').forEach(a => a.textContent = '▶');
                if (!isOpen) {
                    subGrid.classList.add('open');
                    btnP.querySelector('.arrow').textContent = '▼';
                }
                selectCategory(parent, 'All Subcategories');
            });

            // Subcategory buttons
            Array.from(categoriesList[parent]).sort().forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = `  ${sub}`;
                group.appendChild(opt);

                const btnS = document.createElement('button');
                btnS.className = 'btn-cat';
                btnS.textContent = sub;
                btnS.addEventListener('click', e => {
                    e.stopPropagation();
                    selectCategory(parent, sub);
                });
                subGrid.appendChild(btnS);
            });

            catDropdown.appendChild(group);
            wrap.appendChild(btnP);
            wrap.appendChild(subGrid);
            catGrid.appendChild(wrap);
        });

        catDropdown.addEventListener('change', e => {
            const val = e.target.value;
            if (val === 'All Categories') {
                selectCategory('All Parents', 'All Categories');
            } else {
                let parentHit = 'Other';
                for (let p in categoriesList) {
                    if (categoriesList[p].has(val)) { parentHit = p; break; }
                }
                selectCategory(parentHit, val);
            }
        });
    }

    function selectCategory(parent, sub) {
        if (catDropdown) catDropdown.value = (sub !== 'All Categories' && sub !== 'All Subcategories') ? sub : 'All Categories';

        currentParentCategory = parent;
        currentCategory = sub;

        // Highlight parent buttons
        document.querySelectorAll('.btn-parent-cat').forEach(b => {
            const isAll = parent === 'All Parents' && b.textContent.includes('All Inventory');
            const isParent = b.dataset && b.dataset.parent === parent;
            b.classList.toggle('active-parent', isAll || isParent);
        });

        // Highlight sub buttons
        document.querySelectorAll('.btn-cat').forEach(b => {
            b.classList.toggle('active', sub !== 'All Subcategories' && b.textContent === sub);
        });

        renderGrid();
    }

    function renderGrid() {
        if (!grid) return;
        grid.innerHTML = '';

        let filtered = inventory.filter(item => {
            let matchCat;
            if (currentParentCategory === 'All Parents') {
                matchCat = true;
            } else if (currentCategory === 'All Subcategories') {
                matchCat = item.parent_category === currentParentCategory;
            } else {
                matchCat = item.sub_category === currentCategory;
            }

            const query = currentSearch.toLowerCase();
            const matchSearch = !query ||
                item.name.toLowerCase().includes(query) ||
                item.id.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query);
            return matchCat && matchSearch;
        });

        // Apply Sorting
        if (currentSort === 'name-asc') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else if (currentSort === 'name-desc') {
            filtered.sort((a, b) => b.name.localeCompare(a.name));
        } else if (currentSort === 'price-asc') {
            filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (currentSort === 'price-desc') {
            filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        } else if (currentSort === 'qty-asc') {
            filtered.sort((a, b) => (a.available || 0) - (b.available || 0));
        } else if (currentSort === 'qty-desc') {
            filtered.sort((a, b) => (b.available || 0) - (a.available || 0));
        } else if (currentSort === 'newest') {
            filtered.sort((a, b) => {
                const idxA = originalInventoryOrder.findIndex(x => x.id === a.id);
                const idxB = originalInventoryOrder.findIndex(x => x.id === b.id);
                return idxB - idxA;
            });
        }

        if (totalCount) totalCount.textContent = `Showing ${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
        
        if (filtered.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
        } else {
            if (emptyState) emptyState.classList.add('hidden');
            
            filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'product-card';

    const isSelected = !!selectionCart[item.id];

    // Show exact inventory when below 10, otherwise show 10+
    const displayQty = item.available >= 999 ? '10+' : item.available;

    let badgeHTML = '';
                if (item.available <= 0)
    badgeHTML = `<div class="badge out-stock">OUT OF STOCK</div>`;
else if (item.available <= 5)
    badgeHTML = `<div class="badge low-stock">Only ${displayQty} Left</div>`;
else
    badgeHTML = `<div class="badge">In Stock (${displayQty})</div>`;

                card.innerHTML = `
                    <div class="card-img-wrap">
                        ${badgeHTML}
                        <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/150/f0f0f0/888888?text=Image+Missing';">
                    </div>
                    <div class="card-body">
                        <span class="card-category">${item.category}</span>
                        <h2 class="card-title">${item.name}</h2>
                        
                        <div class="card-footer">
                            <div class="card-price">$${item.price}</div>
                            <span class="card-ref">${item.id}</span>
                        </div>
                        <div class="card-stock-status" style="margin-top: 8px; font-size: 0.8rem; font-weight: 600; color: ${item.available > 0 ? '#10b981' : '#ef4444'}">
    ${item.available > 0 ? `Available: ${displayQty}` : 'Out of Stock'}
</div>
                        <button class="add-btn ${isSelected ? 'selected' : ''}" data-id="${item.id}" style="margin-top:10px; width:100%; ${isSelected ? 'background:#10b981; color:white; border-color:#10b981;' : ''}">
                            ${isSelected ? '✓ Selected' : 'Add to Selection'}
                        </button>
                    </div>
                `;
                grid.appendChild(card);
                
                card.querySelector('.add-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    addToSelection(item, e.target);
                });

                card.querySelector('.card-img-wrap').addEventListener('click', () => {
                    openLightbox(item.image, item.name);
                });
            });
        }
    }

    function openLightbox(src, title) {
        if (!imageModal || !modalImg || !modalCaption) return;
        imageModal.style.display = "block";
        modalImg.src = src;
        modalCaption.textContent = title;
        document.body.style.overflow = 'hidden';
    }

    if (closeModal) {
        closeModal.onclick = () => {
            imageModal.style.display = "none";
            document.body.style.overflow = 'auto';
        };
    }

    window.addEventListener('click', (event) => {
        if (event.target == imageModal) {
            imageModal.style.display = "none";
            document.body.style.overflow = 'auto';
        }
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderGrid();
        });
    }

    // --- CART / SELECTION LOGIC ---

    function toggleCart() {
        if (cartPanel) cartPanel.classList.toggle('open');
        if (cartOverlay) cartOverlay.classList.toggle('open');
    }
    
    if (cartToggle) cartToggle.addEventListener('click', toggleCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', toggleCart);
    if (cartOverlay) cartOverlay.addEventListener('click', toggleCart);

    function addToSelection(item, btnElement) {
        if (item.available <= 0) {
            alert(`Sorry, "${item.name}" is out of stock.`);
            return;
        }

        if (!selectionCart[item.id]) {
            selectionCart[item.id] = { product: item, quantity: 1 };
        } else {
            if (selectionCart[item.id].quantity >= item.available) {
                alert(`You cannot add more than the available quantity (${item.available}) for "${item.name}".`);
                return;
            }
            selectionCart[item.id].quantity += 1;
        }
        updateCartUI();
        
        btnElement.textContent = "✓ Selected";
        btnElement.style.background = "#10b981";
        btnElement.style.color = "white";
        btnElement.style.borderColor = "#10b981";
        btnElement.classList.add('selected');
        
        if (cartToggle) {
            cartToggle.style.transform = "scale(1.1)";
            setTimeout(() => { cartToggle.style.transform = "scale(1)"; }, 300);
        }
    }

    function updateCartUI() {
        localStorage.setItem('casaCentralSelectionCart', JSON.stringify(selectionCart));
        if (!cartContent) return;
        cartContent.innerHTML = '';
        const keys = Object.keys(selectionCart);
        if (cartCount) cartCount.textContent = keys.length;
        
        let subtotal = 0;

        if (keys.length === 0) {
            cartContent.innerHTML = '<p style="color:#888; text-align:center; padding: 2rem;">No items selected yet.</p>';
            if(cartGrandTotalEl) cartGrandTotalEl.style.display = 'none';
            if(cartActions) cartActions.style.display = 'none';
            if(clearCartBtn) clearCartBtn.style.display = 'none';
            return;
        } else {
            if(cartGrandTotalEl) cartGrandTotalEl.style.display = 'block';
            if(cartActions) cartActions.style.display = 'flex';
            if(clearCartBtn) clearCartBtn.style.display = 'inline-block';
        }

        keys.forEach(id => {
            const entry = selectionCart[id];
            const itemTotal = parseFloat(entry.product.price) * entry.quantity;
            subtotal += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <img src="${entry.product.image}" alt="${entry.product.name}" style="width:50px; height:50px; object-fit:contain; border-radius:4px;">
                <div class="cart-item-details" style="flex:1; margin-left:15px;">
                    <div class="cart-item-name" style="font-weight:600; font-size:0.85rem; color:#333; line-height:1.2;">${entry.product.name}</div>
                    <div class="cart-item-price" style="font-size:0.8rem; color:#666; margin-top:4px; display:flex; align-items:center; gap:5px;">
                        $<input type="number" class="price-edit" value="${parseFloat(entry.product.price).toFixed(2)}" step="0.01" style="width:65px; padding:2px; border:1px solid #ccc; border-radius:4px; font-size:0.8rem; text-align:center;"> × 
                        <input type="number" class="qty-edit" value="${entry.quantity}" min="1" max="${entry.product.available}" style="width:45px; padding:2px; border:1px solid #ccc; border-radius:4px; font-size:0.8rem; text-align:center;">
                        = $${itemTotal.toFixed(2)}
                    </div>
                </div>
                <button class="remove-btn" style="background:none; border:none; color:#ea4335; font-size:1.4rem; padding:0 10px; cursor:pointer;" title="Remove Item">&times;</button>
            `;
            cartContent.appendChild(div);
            
            div.querySelector('.qty-edit').addEventListener('change', (e) => {
                let newQty = parseInt(e.target.value);
                if (isNaN(newQty) || newQty < 1) newQty = 1;
                if (newQty > entry.product.available) {
                    alert(`Only ${entry.product.available} available in stock.`);
                    newQty = entry.product.available;
                }
                selectionCart[id].quantity = newQty;
                updateCartUI();
            });

            div.querySelector('.price-edit').addEventListener('change', (e) => {
                let newPrice = parseFloat(e.target.value);
                if (isNaN(newPrice) || newPrice < 0) newPrice = 0;
                selectionCart[id].product.price = newPrice.toFixed(2);
                updateCartUI();
            });

            div.querySelector('.remove-btn').addEventListener('click', () => {
                delete selectionCart[id];
                updateCartUI();
                renderGrid();
            });
        });

        if(cartGrandTotalEl) {
            const salesTax = subtotal * TAX_RATE;
            const grandTotal = subtotal + salesTax;
            cartGrandTotalEl.innerHTML = `
                <div style="font-size:0.85rem; color:#666; display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span>Subtotal:</span> <span>$${subtotal.toFixed(2)}</span>
                </div>
                <div style="font-size:0.85rem; color:#666; display:flex; justify-content:space-between; margin-bottom:6px; border-bottom:1px dashed #ddd; padding-bottom:4px;">
                    <span>Sales Tax (3.3125%):</span> <span>$${salesTax.toFixed(2)}</span>
                </div>
                <div style="font-weight:700; font-size:1.1rem; color:#1e3c72; display:flex; justify-content:space-between;">
                    <span>Grand Total:</span> <span>$${grandTotal.toFixed(2)}</span>
                </div>
            `;
        }
    }

    function getSelectionArray() {
        return Object.values(selectionCart);
    }

    if(clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if(confirm("Are you sure you want to clear your entire selection?")) {
                selectionCart = {};
                updateCartUI();
                renderGrid();
            }
        });
    }

    const copyCartBtn = document.getElementById('copyCart');

    // 📋 Copy Rich Table to Clipboard
    if (copyCartBtn) {
        copyCartBtn.addEventListener('click', async () => {
            const items = getSelectionArray();
            if(items.length === 0) return alert("Selection is empty.");
            
            const originalText = copyCartBtn.textContent;
            copyCartBtn.textContent = "⌛ Generating...";

            const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
            
            let html = `
                <table style="border-collapse:collapse; width:100%; font-family: sans-serif; border: 1px solid #ddd;">
                    <thead>
                        <tr style="background:#1e3c72; color:white;">
                            <th style="padding:10px; border:1px solid #ddd;">Preview</th>
                            <th style="padding:10px; border:1px solid #ddd;">Ref ID</th>
                            <th style="padding:10px; border:1px solid #ddd;">Product Name</th>
                            <th style="padding:10px; border:1px solid #ddd;">Qty</th>
                            <th style="padding:10px; border:1px solid #ddd;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let grandSum = 0;
            items.forEach(i => {
                let total = parseFloat(i.product.price) * i.quantity;
                grandSum += total;
                let imgSrc = i.product.image;
                if(!imgSrc.startsWith('http')) imgSrc = baseUrl + imgSrc;
                
                html += `
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;">
                            <img src="${imgSrc}" width="60" style="max-width:60px;">
                        </td>
                        <td style="padding:10px; border:1px solid #ddd;">${i.product.id}</td>
                        <td style="padding:10px; border:1px solid #ddd;">${i.product.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;">${i.quantity}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;">$${total.toFixed(2)}</td>
                    </tr>
                `;
            });
            const salesTax = grandSum * TAX_RATE;
            const finalTotal = grandSum + salesTax;

            html += `
                    <tr style="background:#f8fafc; font-size:0.9rem; color:#475569;">
                        <td colspan="4" style="padding:8px 10px; border:1px solid #ddd; text-align:right; font-weight:bold;">Subtotal:</td>
                        <td style="padding:8px 10px; border:1px solid #ddd; text-align:center; font-weight:bold;">$${grandSum.toFixed(2)}</td>
                    </tr>
                    <tr style="background:#f8fafc; font-size:0.9rem; color:#475569;">
                        <td colspan="4" style="padding:8px 10px; border:1px solid #ddd; text-align:right; font-weight:bold;">Sales Tax (3.3125%):</td>
                        <td style="padding:8px 10px; border:1px solid #ddd; text-align:center; font-weight:bold;">$${salesTax.toFixed(2)}</td>
                    </tr>
                    <tr style="background:#f1f5f9; font-weight:bold;">
                        <td colspan="4" style="padding:10px; border:1px solid #ddd; text-align:right;">GRAND TOTAL:</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center; color:#1e3c72; font-size:1.1rem;">$${finalTotal.toFixed(2)}</td>
                    </tr>
                </tbody>
                </table>
            `;

            try {
                const blob = new Blob([html], { type: 'text/html' });
                const data = [new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([html.replace(/<[^>]*>/g, '')], { type: 'text/plain' }) })];
                await navigator.clipboard.write(data);
                copyCartBtn.textContent = "✅ Copied! Opening Gmail...";
                
                setTimeout(() => {
                    const subject = encodeURIComponent("Catalog Information Request");
                    const defaultBody = encodeURIComponent("Hello Casa Central Team,\n\nI have copied my selection. Here it is (Please Paste / Ctrl+V below this line):\n\n====================\n\n\n");
                    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${defaultBody}`);
                    copyCartBtn.textContent = originalText;
                }, 800);

            } catch (err) {
                console.error(err);
                alert("Clipboard Error. Try again in Chrome/Edge.");
                copyCartBtn.textContent = originalText;
            }
        });
    }

    // 📊 Save as Excel (.xlsx) using ExcelJS
    if (excelCart) {
        excelCart.addEventListener('click', async () => {
            const items = getSelectionArray();
            if(items.length === 0) return alert("Selection is empty.");

            const originalText = excelCart.textContent;
            excelCart.textContent = "Fetching Images...";
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Catalog Selection');

            worksheet.getRow(1).height = 30;
            worksheet.getRow(1).font = { bold: true };

            worksheet.columns = [
                { header: 'Preview', key: 'img', width: 22 }, 
                { header: 'Reference ID', key: 'id', width: 15 },
                { header: 'Product Name', key: 'name', width: 40, style: { alignment: { wrapText: true, vertical: 'middle' } } },
                { header: 'Category', key: 'category', width: 20, style: { alignment: { wrapText: true, vertical: 'middle' } } },
                { header: 'Unit Price', key: 'price', width: 12 },
                { header: 'Quantity', key: 'qty', width: 10 },
                { header: 'Total Price', key: 'total', width: 15 }
            ];

            const borderStyle = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };

            for(let idx = 0; idx < items.length; idx++) {
                const i = items[idx];
                const rowNo = idx + 2;
                excelCart.textContent = `Processing ${idx+1}/${items.length}...`;

                const row = worksheet.addRow({
                    id: i.product.id,
                    name: i.product.name,
                    category: i.product.category,
                    price: parseFloat(i.product.price),
                    qty: i.quantity,
                    total: parseFloat(i.product.price) * i.quantity
                });
                row.height = 110; 
                
                row.eachCell({ includeEmpty: true }, (cell) => {
                    const align = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    if(cell.column === 3 || cell.column === 4) align.horizontal = 'left';
                    cell.alignment = align;
                    cell.border = borderStyle;
                });

                try {
                    let imgSrc = i.product.image;
                    if(!imgSrc.startsWith('http')) {
                        imgSrc = window.location.origin + window.location.pathname.replace('index.html', '') + imgSrc;
                    }
                    
                    const response = await fetch(imgSrc);
                    const arrayBuffer = await response.arrayBuffer();
                    const imageId = workbook.addImage({
                        buffer: arrayBuffer,
                        extension: 'png',
                    });

                    worksheet.addImage(imageId, {
                        tl: { col: 0.1, row: rowNo - 0.95 },
                        ext: { width: 140, height: 140 },
                        editAs: 'oneCell'
                    });
                } catch (err) {
                    console.error("Excel Image Error:", err);
                }
            }

            worksheet.getColumn('price').numFmt = '$#,##0.00';
            worksheet.getColumn('total').numFmt = '$#,##0.00';

            const subtotal = items.reduce((acc, i) => acc + (parseFloat(i.product.price) * i.quantity), 0);
            const salesTax = subtotal * TAX_RATE;
            const grandTotal = subtotal + salesTax;

            const subtotalRow = worksheet.addRow({ total: subtotal });
            worksheet.mergeCells(`A${subtotalRow.number}:F${subtotalRow.number}`);
            worksheet.getCell(`A${subtotalRow.number}`).value = 'SUBTOTAL:';
            worksheet.getCell(`G${subtotalRow.number}`).numFmt = '$#,##0.00';

            const taxRow = worksheet.addRow({ total: salesTax });
            worksheet.mergeCells(`A${taxRow.number}:F${taxRow.number}`);
            worksheet.getCell(`A${taxRow.number}`).value = 'SALES TAX (3.3125%):';
            worksheet.getCell(`G${taxRow.number}`).numFmt = '$#,##0.00';

            const totalRow = worksheet.addRow({ total: grandTotal });
            worksheet.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
            worksheet.getCell(`A${totalRow.number}`).value = 'SELECTION GRAND TOTAL:';
            worksheet.getCell(`G${totalRow.number}`).numFmt = '$#,##0.00';

            [subtotalRow, taxRow, totalRow].forEach((row, idx) => {
                row.height = idx === 2 ? 35 : 25;
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.border = borderStyle;
                    cell.font = { bold: true, size: idx === 2 ? 12 : 10 };
                    if (cell.column <= 6) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    } else {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.numFmt = '$#,##0.00';
                        if (idx === 2) cell.font.color = { argb: 'FF1E3C72' };
                    }
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: idx === 2 ? 'FFE2E8F0' : 'FFF1F5F9' }
                    };
                });
            });

            const headerRow = worksheet.getRow(1);
            headerRow.height = 35;
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E3C72' }
                };
                cell.border = borderStyle;
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Catalog_Selection_${new Date().getTime()}.xlsx`);
            
            excelCart.textContent = originalText;
        });
    }

    // 📄 Native Vector PDF Generation (jsPDF + autoTable)
    if (pdfCart) {
        pdfCart.addEventListener('click', async () => {
            const items = getSelectionArray();
            if(items.length === 0) return alert("Selection is empty.");
            
            pdfCart.textContent = "Loading Images...";

            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                
                doc.setFontSize(18);
                doc.setTextColor(30, 60, 114);
                doc.text("Casa Central", 14, 20);
                
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Date: ${new Date().toLocaleDateString()}`, 160, 20);
                
                doc.setFontSize(14);
                doc.setTextColor(50, 50, 50);
                doc.text("Selected Product Request", 14, 30);
                
                const tableData = [];
                const imageMap = {}; 
                
                const imagePromises = items.map(async (i, index) => {
                    let total = (parseFloat(i.product.price) * i.quantity).toFixed(2);
                    
                    tableData[index] = [
                        "", 
                        i.product.id,
                        i.product.name,
                        i.product.category,
                        i.quantity.toString(),
                        "$" + parseFloat(i.product.price).toFixed(2),
                        "$" + total
                    ];
                    
                    let imgSrc = i.product.image;
                    if(!imgSrc.startsWith('http')) {
                        imgSrc = window.location.origin + window.location.pathname.replace('index.html', '') + imgSrc;
                    }
                    
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            imageMap[index] = canvas.toDataURL('image/jpeg', 0.95);
                            resolve();
                        };
                        img.onerror = resolve; 
                        img.src = imgSrc;
                    });
                });
                
                await Promise.all(imagePromises);
                
                pdfCart.textContent = "Rendering PDF...";

                doc.autoTable({
                    startY: 35,
                    head: [['Preview', 'Ref ID', 'Product Name', 'Category', 'Qty', 'Unit Price', 'Total']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [30, 60, 114], textColor: 255 },
                    styles: { cellPadding: 3, valign: 'middle', halign: 'center', fontSize: 9 },
                    columnStyles: {
                        0: { cellWidth: 25, minCellHeight: 25 },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 'auto', halign: 'left' },
                        3: { cellWidth: 28 },
                        4: { cellWidth: 15, fontStyle: 'bold' },
                        5: { cellWidth: 20 },
                        6: { cellWidth: 25, fontStyle: 'bold' }
                    },
                    didDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index === 0) {
                            const base64Img = imageMap[data.row.index];
                            if (base64Img) {
                                const padding = 2;
                                const x = data.cell.x + padding;
                                const y = data.cell.y + padding;
                                const w = data.cell.width - (padding * 2);
                                const h = data.cell.height - (padding * 2);
                                const dim = Math.min(w, h);
                                const offsetX = x + (w - dim) / 2; 
                                const offsetY = y + (h - dim) / 2; 
                                doc.addImage(base64Img, 'JPEG', offsetX, offsetY, dim, dim);
                            }
                        }
                    }
                });
                
                const subtotal = items.reduce((acc, i) => acc + (parseFloat(i.product.price) * i.quantity), 0);
                const salesTax = subtotal * TAX_RATE;
                const grandTotal = subtotal + salesTax;

                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 0,
                    body: [
                        ["SUBTOTAL:", "$" + subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
                        ["SALES TAX (3.3125%):", "$" + salesTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
                        ["SELECTION GRAND TOTAL:", "$" + grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]
                    ],
                    theme: 'grid',
                    styles: { fontSize: 9, fontStyle: 'bold', halign: 'right', cellPadding: 3 },
                    margin: { left: 14, right: 14 },
                    columnStyles: {
                        0: { fillColor: [241, 245, 249] },
                        1: { cellWidth: 25, halign: 'center', textColor: [30, 60, 114], fillColor: [226, 232, 240] }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.row.index === 2) {
                            if (data.column.index === 0) data.cell.styles.fillColor = [226, 232, 240];
                        }
                    }
                });
                
                doc.save(`Catalog_Quote_${new Date().getTime()}.pdf`);
                pdfCart.textContent = "📄 Save as PDF";

            } catch (error) {
                console.error("PDF Generator Error:", error);
                alert("An error occurred while generating the PDF.");
                pdfCart.textContent = "📄 Save as PDF";
            }
        });
    }
});
