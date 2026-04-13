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

    const sortSelect = document.getElementById('sortSelect');
    
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
    let selectionCart = {};

    // Boot Up
    loadData();

    async function loadData() {
        try {
            const response = await fetch('./data/inventory.json');
            if (!response.ok) throw new Error('Network response error');
            const data = await response.json();
            
            inventory = data.items;
            originalInventoryOrder = [...data.items];
            
            // Meta updates
            updateDate.textContent = data.last_updated || "Live";
            if(data.downloads.excel) { dlExcelBtn.href = data.downloads.excel; } else { dlExcelBtn.style.display = 'none'; }
            if(data.downloads.pdf) { dlPdfBtn.href = data.downloads.pdf; } else { dlPdfBtn.style.display = 'none'; }
            
            inventory.forEach(item => {
                let p = item.parent_category || "Other";
                let s = item.sub_category || item.category || "Uncategorized";
                if(!categoriesList[p]) categoriesList[p] = new Set();
                categoriesList[p].add(s);
            });
            
            buildFilters();
            renderGrid();
        } catch (error) {
            totalCount.textContent = "Error loading inventory data.";
            console.error('Fetch error:', error);
        }
    }

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderGrid();
    });

    function buildFilters() {
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
        currentParentCategory = parent;
        currentCategory = sub;

        catDropdown.value = (sub !== 'All Categories' && sub !== 'All Subcategories') ? sub : 'All Categories';

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
            // Assume the bottom of original list is newest if not timestamped
            filtered.sort((a, b) => {
                const idxA = originalInventoryOrder.findIndex(x => x.id === a.id);
                const idxB = originalInventoryOrder.findIndex(x => x.id === b.id);
                return idxB - idxA;
            });
        }

        totalCount.textContent = `Showing ${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
        
        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            
            filtered.forEach(item => {
                const card = document.createElement('article');
                card.className = 'product-card';
                
                let badgeHTML = '';
                if (item.available <= 0) badgeHTML = `<div class="badge out-stock">OUT OF STOCK</div>`;
                else if (item.available <= 5) badgeHTML = `<div class="badge low-stock">Only ${item.available} Left</div>`;
                else badgeHTML = `<div class="badge">In Stock (${item.available})</div>`;

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
                            ${item.available > 0 ? `Available: ${item.available}` : 'Out of Stock'}
                        </div>
                        <button class="add-btn" data-id="${item.id}" style="margin-top:10px; width:100%;">Add to Selection</button>
                    </div>
                `;
                grid.appendChild(card);
                
                // Add event listener to the Select button
                card.querySelector('.add-btn').addEventListener('click', (e) => addToSelection(item, e.target));
            });
        }
    }

    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderGrid();
    });

    // --- CART / SELECTION LOGIC ---

    function toggleCart() {
        cartPanel.classList.toggle('open');
        cartOverlay.style.display = cartPanel.classList.contains('open') ? 'block' : 'none';
        setTimeout(() => cartOverlay.classList.toggle('open'), 10);
    }
    
    cartToggle.addEventListener('click', toggleCart);
    closeCartBtn.addEventListener('click', toggleCart);
    cartOverlay.addEventListener('click', toggleCart);

    function addToSelection(item, btnElement) {
        if (!selectionCart[item.id]) {
            selectionCart[item.id] = { product: item, quantity: 1 };
        } else {
            selectionCart[item.id].quantity += 1;
        }
        updateCartUI();
        
        // Visual feedback instead of popping open the cart
        const originalText = btnElement.textContent;
        btnElement.textContent = "✓ Added!";
        btnElement.style.background = "#10b981";
        btnElement.style.color = "white";
        btnElement.style.borderColor = "#10b981";
        
        // Wiggle the top cart button
        cartToggle.style.transform = "scale(1.1)";
        setTimeout(() => {
            cartToggle.style.transform = "scale(1)";
            btnElement.textContent = originalText;
            btnElement.style.background = "";
            btnElement.style.color = "";
            btnElement.style.borderColor = "";
        }, 1000);
    }

    function updateCartUI() {
        cartContent.innerHTML = '';
        const keys = Object.keys(selectionCart);
        cartCount.textContent = keys.length;
        
        if (keys.length === 0) {
            cartContent.innerHTML = '<p style="color:#888; text-align:center; padding: 2rem;">No items selected yet.</p>';
            return;
        }

        keys.forEach(id => {
            const row = selectionCart[id];
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${row.product.name}</h4>
                    <p>Ref: ${id} | $${row.product.price}</p>
                </div>
                <div style="display:flex; align-items:center;">
                    <input type="number" min="1" class="cart-qty" value="${row.quantity}" data-id="${id}">
                    <button class="remove-item" data-id="${id}">&times;</button>
                </div>
            `;
            cartContent.appendChild(div);
            
            // Qty Event Listener
            div.querySelector('.cart-qty').addEventListener('change', (e) => {
                selectionCart[id].quantity = parseInt(e.target.value) || 1;
            });
            // Remove event listener
            div.querySelector('.remove-item').addEventListener('click', () => {
                delete selectionCart[id];
                updateCartUI();
            });
        });
    }

    // Export Logic
    
    function getSelectionArray() {
        return Object.values(selectionCart);
    }

    // ✉️ Selection Inquiry (Email)
    emailCart.addEventListener('click', () => {
        const items = getSelectionArray();
        if(items.length === 0) return alert("Selection is empty.");
        
        let body = "Hello Golden Opportunity Catalog Team,\n\nI am interested in the following items from the Live Inventory:\n\n";
        items.forEach(i => {
            let total = (parseFloat(i.product.price) * i.quantity).toFixed(2);
            body += `- ${i.quantity}x ${i.product.name} (Ref: ${i.product.id}) @ $${i.product.price} each = Total: $${total}\n`;
        });
        body += "\nPlease let me know if these items are available.\n\nThank you.";
        
        const subject = encodeURIComponent("Catalog Information Request");
        const mailBody = encodeURIComponent(body);
        
        // This will trigger the user's default mail client (Outlook, Mail, or Browser handler)
        window.location.href = `mailto:info@goldenopportunity.com?subject=${subject}&body=${mailBody}`;
    });

    // 📊 Save as Excel (.xlsx) using ExcelJS with embedded images
    excelCart.addEventListener('click', async () => {
        const items = getSelectionArray();
        if(items.length === 0) return alert("Selection is empty.");

        const originalText = excelCart.textContent;
        excelCart.textContent = "Fetching Images...";
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Catalog Selection');

        // Styles
        worksheet.getRow(1).height = 25;
        worksheet.getRow(1).font = { bold: true };

        worksheet.columns = [
            { header: 'Preview', key: 'img', width: 15 },
            { header: 'Reference ID', key: 'id', width: 15 },
            { header: 'Product Name', key: 'name', width: 40 },
            { header: 'Category', key: 'category', width: 22 },
            { header: 'Unit Price', key: 'price', width: 12 },
            { header: 'Quantity', key: 'qty', width: 10 },
            { header: 'Total Price', key: 'total', width: 15 }
        ];

        // Process items with images
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
            row.height = 65;
            row.alignment = { vertical: 'middle' };

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
                    tl: { col: 0.1, row: rowNo - 1 + 0.1 },
                    br: { col: 0.9, row: rowNo - 0.1 }
                });
            } catch (err) {
                console.error("Excel Image Error:", err);
            }
        }

        worksheet.getColumn('price').numFmt = '$#,##0.00';
        worksheet.getColumn('total').numFmt = '$#,##0.00';

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Catalog_Selection_${new Date().getTime()}.xlsx`);
        
        excelCart.textContent = originalText;
    });

    // 📄 Save as PDF with Images
    pdfCart.addEventListener('click', async () => {
        const items = getSelectionArray();
        if(items.length === 0) return alert("Selection is empty.");
        
        pdfCart.textContent = "Loading Images...";

        const wrap = document.createElement('div');
        wrap.style.padding = "40px";
        wrap.style.backgroundColor = "white";
        wrap.style.fontFamily = "'Inter', sans-serif";
        
        wrap.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #EEE; padding-bottom: 20px; margin-bottom: 20px;">
                <h2 style="margin:0; color:#1e3c72;">Golden Opportunity Catalog</h2>
                <span style="color:#666;">Date: ${new Date().toLocaleDateString()}</span>
            </div>
            <h3 style="color:#333;">Selected Product Request</h3>
            <table style="width:100%; text-align:left; border-collapse:collapse; font-size:12px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding:12px; border:1px solid #EEE;">Preview</th>
                        <th style="padding:12px; border:1px solid #EEE;">Ref ID</th>
                        <th style="padding:12px; border:1px solid #EEE;">Product Name</th>
                        <th style="padding:12px; border:1px solid #EEE;">Qty</th>
                        <th style="padding:12px; border:1px solid #EEE;">Unit Price</th>
                        <th style="padding:12px; border:1px solid #EEE;">Total</th>
                    </tr>
                </thead>
                <tbody id="pdfTableBody"></tbody>
            </table>
        `;

        const tbody = wrap.querySelector('#pdfTableBody');
        const imagePromises = items.map(async (i) => {
            let total = (parseFloat(i.product.price) * i.quantity).toFixed(2);
            let imgSrc = i.product.image;
            if(!imgSrc.startsWith('http')) {
                imgSrc = window.location.origin + window.location.pathname.replace('index.html', '') + imgSrc;
            }

            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding:10px; border:1px solid #EEE; text-align:center;">
                            <img src="${imgSrc}" style="width:60px; height:60px; object-fit:contain;">
                        </td>
                        <td style="padding:10px; border:1px solid #EEE;">${i.product.id}</td>
                        <td style="padding:10px; border:1px solid #EEE; max-width: 200px;">${i.product.name}</td>
                        <td style="padding:10px; border:1px solid #EEE; font-weight:bold;">${i.quantity}</td>
                        <td style="padding:10px; border:1px solid #EEE;">$${parseFloat(i.product.price).toFixed(2)}</td>
                        <td style="padding:10px; border:1px solid #EEE; font-weight:bold;">$${total}</td>
                    `;
                    tbody.appendChild(tr);
                    resolve();
                };
                img.onerror = () => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td colspan="6">Image Error for ${i.product.id}</td>`;
                    tbody.appendChild(tr);
                    resolve();
                };
                img.src = imgSrc;
            });
        });

        await Promise.all(imagePromises);
        
        pdfCart.textContent = "Rendering...";
        
        const opt = {
            margin: 10,
            filename: `Catalog_Quote_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().from(wrap).set(opt).save().then(() => {
            pdfCart.textContent = "📄 Save as PDF";
        });
    });

});
