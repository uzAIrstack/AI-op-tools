// ========================================
// Executive Education ROI Calculator
// ========================================

(function () {
  'use strict';

  // --- Canvas Fee Schedule (per participant, based on tuition per participant) ---
  const CANVAS_FEE_SCHEDULE = [
    { min: 1,     max: 750,      fee: 30 },
    { min: 751,   max: 1000,     fee: 45 },
    { min: 1001,  max: 3000,     fee: 60 },
    { min: 3001,  max: 5000,     fee: 90 },
    { min: 5001,  max: 7000,     fee: 110 },
    { min: 7001,  max: 10000,    fee: 120 },
    { min: 10001, max: Infinity, fee: 140 },
  ];

  function getCanvasFeePerParticipant(tuitionPerParticipant) {
    if (tuitionPerParticipant <= 0) return 0;
    for (const tier of CANVAS_FEE_SCHEDULE) {
      if (tuitionPerParticipant >= tier.min && tuitionPerParticipant <= tier.max) {
        return tier.fee;
      }
    }
    return 140; // fallback for > 10000
  }

  // --- Dark Mode Toggle ---
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  updateToggleIcon();

  toggle && toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    updateToggleIcon();
  });

  function updateToggleIcon() {
    if (!toggle) return;
    toggle.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    toggle.innerHTML = theme === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // --- Toggle Bar Logic ---
  document.querySelectorAll('.toggle-bar').forEach(bar => {
    bar.querySelectorAll('.toggle-option').forEach(btn => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.toggle-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (bar.id === 'revenueToggle') {
          handleRevenueToggle(btn.dataset.value);
        }
        recalculate();
      });
    });
  });

  function getToggleValue(barId) {
    const bar = document.getElementById(barId);
    if (!bar) return '';
    const active = bar.querySelector('.toggle-option.active');
    return active ? active.dataset.value : '';
  }

  function handleRevenueToggle(mode) {
    document.getElementById('revenueCalculated').style.display = mode === 'calculate' ? 'block' : 'none';
    document.getElementById('revenueManual').style.display = mode === 'manual' ? 'block' : 'none';
  }

  // --- IDC Rate Calculation ---
  function getIDCRate() {
    const revenueType = getToggleValue('revenueTypeToggle');

    // Donation: no indirect costs
    if (revenueType === 'donation') {
      return { rate: 0, label: 'Donation (No IDC)' };
    }

    const credit = getToggleValue('creditToggle');
    const delivery = getToggleValue('deliveryToggle');
    const ogps = getToggleValue('ogpsToggle');

    // OGPS partner programs: 10% flat
    if (ogps === 'yes') {
      return { rate: 0.10, label: 'OGPS Partner (10%)' };
    }

    // Online programs use off-campus rates
    const effectiveDelivery = delivery === 'online' ? 'off-campus' : delivery;

    if (credit === 'credit' && effectiveDelivery === 'on-campus') {
      return { rate: 0.50, label: 'Credit / On-Campus' };
    } else if (credit === 'credit' && effectiveDelivery === 'off-campus') {
      return { rate: 0.40, label: delivery === 'online' ? 'Credit / Online (Off-Campus Rate)' : 'Credit / Off-Campus' };
    } else if (credit === 'noncredit' && effectiveDelivery === 'on-campus') {
      return { rate: 0.30, label: 'Non-Credit / On-Campus' };
    } else if (credit === 'noncredit' && effectiveDelivery === 'off-campus') {
      return { rate: 0.25, label: delivery === 'online' ? 'Non-Credit / Online (Off-Campus Rate)' : 'Non-Credit / Off-Campus' };
    }

    return { rate: 0.30, label: 'Default' };
  }

  // --- Number Formatting ---
  function formatCurrency(num) {
    if (isNaN(num) || num === null) return '$0';
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(Math.round(num));
    return sign + '$' + abs.toLocaleString('en-US');
  }

  function formatPercent(num) {
    if (isNaN(num) || !isFinite(num)) return '0%';
    return (num * 100).toFixed(1) + '%';
  }

  function formatRatio(num) {
    if (isNaN(num) || !isFinite(num)) return '0.00';
    return num.toFixed(2);
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? (parseFloat(el.value) || 0) : 0;
  }

  // --- Optional detail lines for revenue and expense categories ---
  const SUBLINE_CATEGORIES = {
    manualRevenue: 'Total Program Revenue',
    tuitionRemission: 'Tuition Remission Expense',
    salProgramManager: 'Program Manager',
    salTeachingStipend: 'Teaching Stipend',
    salGuestLecturer: 'Guest Lecturer',
    salConsultant: 'Consultant / Professional Services',
    salOther: 'Other Salaries',
    fringeFTBase: 'Full-Time Fringe Base',
    fringePTBase: 'Part-Time Fringe Base',
    travelCosts: 'Travel Costs',
    adminCosts: 'Administrative Costs',
    suppliesCosts: 'General Supplies & Expenses',
    advertisingCosts: 'Advertising & Publicity',
    materialsCosts: 'Classroom Materials',
    foodCosts: 'Food Service / Catering',
    otherDirectCosts: 'Other Direct Costs',
    equipmentRental: 'Equipment Rental',
    spaceRental: 'Space Rental',
    contractualExpenses: 'Contractual Expenses',
    otherExcluded: 'Other Excluded Costs'
  };

  const sublineItems = {};
  let sublineSequence = 0;

  function getSublineItems(categoryId) {
    return sublineItems[categoryId] || [];
  }

  function getMeaningfulSublineItems(categoryId) {
    return getSublineItems(categoryId).filter(item => item.description.trim() || item.amount !== 0);
  }

  function syncSublineTotal(categoryId) {
    const input = document.getElementById(categoryId);
    const items = getSublineItems(categoryId);
    if (!input) return;

    if (items.length) {
      const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      input.value = total;
      input.readOnly = true;
      input.classList.add('is-rollup');
      input.setAttribute('aria-label', SUBLINE_CATEGORIES[categoryId] + ' total, calculated from detail lines');
      input.title = 'Calculated from the detail lines below';
    } else {
      input.readOnly = false;
      input.classList.remove('is-rollup');
      input.setAttribute('aria-label', SUBLINE_CATEGORIES[categoryId]);
      input.removeAttribute('title');
    }

    const block = document.querySelector('[data-subline-category="' + categoryId + '"]');
    const status = block ? block.querySelector('.rollup-status') : null;
    if (status) {
      status.textContent = items.length
        ? formatCurrency(getVal(categoryId)) + ' total from ' + items.length + (items.length === 1 ? ' line' : ' lines')
        : '';
      status.hidden = items.length === 0;
    }
  }

  function renderSublineEditor(categoryId) {
    const block = document.querySelector('[data-subline-category="' + categoryId + '"]');
    if (!block) return;

    const list = block.querySelector('.subline-list');
    const addButton = block.querySelector('.add-subline-btn');
    const items = getSublineItems(categoryId);
    list.replaceChildren();
    list.hidden = items.length === 0;
    addButton.textContent = items.length ? '+ Add another line' : '+ Add lines';
    addButton.setAttribute('aria-expanded', items.length ? 'true' : 'false');

    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'subline-row';

      const branch = document.createElement('span');
      branch.className = 'subline-branch';
      branch.setAttribute('aria-hidden', 'true');
      branch.textContent = '↳';

      const description = document.createElement('input');
      description.type = 'text';
      description.className = 'input subline-description';
      description.placeholder = 'Line description';
      description.value = item.description;
      description.setAttribute('aria-label', SUBLINE_CATEGORIES[categoryId] + ' line ' + (index + 1) + ' description');
      description.addEventListener('input', () => {
        item.description = description.value;
      });

      const amountGroup = document.createElement('div');
      amountGroup.className = 'input-prefix-group subline-amount-group';
      const prefix = document.createElement('span');
      prefix.className = 'input-prefix';
      prefix.textContent = '$';
      const amount = document.createElement('input');
      amount.type = 'number';
      amount.className = 'input subline-amount';
      amount.min = '0';
      amount.step = '0.01';
      amount.placeholder = '0';
      amount.value = item.amount || '';
      amount.setAttribute('aria-label', SUBLINE_CATEGORIES[categoryId] + ' line ' + (index + 1) + ' amount');
      amount.addEventListener('input', () => {
        item.amount = parseFloat(amount.value) || 0;
        syncSublineTotal(categoryId);
        recalculate();
      });
      amountGroup.append(prefix, amount);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-subline-btn';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + SUBLINE_CATEGORIES[categoryId] + ' line ' + (index + 1));
      remove.addEventListener('click', () => {
        sublineItems[categoryId] = items.filter(candidate => candidate.id !== item.id);
        syncSublineTotal(categoryId);
        renderSublineEditor(categoryId);
        recalculate();
      });

      row.append(branch, description, amountGroup, remove);
      list.appendChild(row);
    });

    syncSublineTotal(categoryId);
  }

  function addSubline(categoryId) {
    const items = getSublineItems(categoryId);
    const existingAmount = items.length === 0 ? getVal(categoryId) : 0;
    const newItem = {
      id: ++sublineSequence,
      description: '',
      amount: existingAmount
    };
    sublineItems[categoryId] = [...items, newItem];
    renderSublineEditor(categoryId);
    recalculate();

    const block = document.querySelector('[data-subline-category="' + categoryId + '"]');
    const descriptions = block ? block.querySelectorAll('.subline-description') : [];
    const newestDescription = descriptions[descriptions.length - 1];
    if (newestDescription) newestDescription.focus();
  }

  function initializeSublineEditors() {
    Object.keys(SUBLINE_CATEGORIES).forEach(categoryId => {
      const input = document.getElementById(categoryId);
      if (!input) return;

      let mainRow = input.closest('.expense-row');
      if (!mainRow) {
        mainRow = input.closest('.manual-revenue-input');
        if (mainRow) mainRow.classList.add('manual-revenue-line');
      }
      if (!mainRow || mainRow.parentElement.matches('[data-subline-category]')) return;

      const block = document.createElement('div');
      block.className = 'line-category-block';
      block.dataset.sublineCategory = categoryId;
      mainRow.parentNode.insertBefore(block, mainRow);
      block.appendChild(mainRow);

      const label = mainRow.querySelector(':scope > label');
      if (label) {
        const labelGroup = document.createElement('div');
        labelGroup.className = 'line-category-label';
        label.parentNode.insertBefore(labelGroup, label);
        labelGroup.appendChild(label);

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-subline-btn';
        addButton.textContent = '+ Add lines';
        addButton.setAttribute('aria-expanded', 'false');
        addButton.setAttribute('aria-controls', categoryId + 'SublineList');
        addButton.addEventListener('click', () => addSubline(categoryId));
        labelGroup.appendChild(addButton);
      }

      const status = document.createElement('span');
      status.className = 'rollup-status';
      status.hidden = true;
      mainRow.appendChild(status);

      const list = document.createElement('div');
      list.className = 'subline-list';
      list.id = categoryId + 'SublineList';
      list.hidden = true;
      block.appendChild(list);

      renderSublineEditor(categoryId);
    });
  }

  // --- Compute tuition per participant and total students ---
  function getEnrollmentInfo() {
    const revenueMode = getToggleValue('revenueToggle');
    let totalStudents = 0;
    let totalRevenue = 0;

    if (revenueMode === 'calculate') {
      const semesters = ['summer', 'fall', 'spring'];
      semesters.forEach(sem => {
        const stu = getVal(sem + 'Students');
        const crs = getVal(sem + 'Courses');
        const cred = getVal(sem + 'Credits');
        const rate = getVal(sem + 'Rate');
        totalStudents += stu;
        totalRevenue += stu * crs * cred * rate;
      });
    } else {
      totalRevenue = getVal('manualRevenue');
    }

    const tuitionPerParticipant = totalStudents > 0 ? totalRevenue / totalStudents : 0;
    return { totalStudents, totalRevenue, tuitionPerParticipant };
  }

  // --- Main Recalculation ---
  function recalculate() {
    const revenueType = getToggleValue('revenueTypeToggle');
    const isDonation = revenueType === 'donation';
    const isOGPS = getToggleValue('ogpsToggle') === 'yes';
    const paymentMethod = getToggleValue('paymentMethodToggle');

    // Show/hide OGPS fee section
    const ogpsFeeSection = document.getElementById('ogpsFeeSection');
    ogpsFeeSection.style.display = isOGPS ? 'block' : 'none';

    // Show/hide OGPS fee rows in results
    document.getElementById('resultOgpsFeesSection').style.display = isOGPS ? 'block' : 'none';

    // Show/hide indirect costs section & donation banner
    document.getElementById('indirectCostsSection').style.display = isDonation ? 'none' : '';
    document.getElementById('donationBanner').style.display = isDonation ? 'flex' : 'none';

    // IDC rate display
    const idcInfo = getIDCRate();
    document.getElementById('idcRateDisplay').textContent = isDonation ? 'N/A' : (idcInfo.rate * 100) + '%';
    document.getElementById('idcRateNote').textContent = idcInfo.label;

    // Revenue
    const revenueMode = getToggleValue('revenueToggle');
    let totalRevenue = 0;

    if (revenueMode === 'calculate') {
      const summerSub = getVal('summerStudents') * getVal('summerCourses') * getVal('summerCredits') * getVal('summerRate');
      document.getElementById('summerTotal').textContent = formatCurrency(summerSub);

      const fallSub = getVal('fallStudents') * getVal('fallCourses') * getVal('fallCredits') * getVal('fallRate');
      document.getElementById('fallTotal').textContent = formatCurrency(fallSub);

      const springSub = getVal('springStudents') * getVal('springCourses') * getVal('springCredits') * getVal('springRate');
      document.getElementById('springTotal').textContent = formatCurrency(springSub);

      totalRevenue = summerSub + fallSub + springSub;
    } else {
      totalRevenue = getVal('manualRevenue');
    }

    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('resultRevenue').textContent = formatCurrency(totalRevenue);

    // Expenses - Tuition Remission
    const tuitionRemission = getVal('tuitionRemission');
    document.getElementById('resultRemission').textContent = formatCurrency(tuitionRemission);

    // Subtotal A - Salaries
    const salaries = [
      getVal('salProgramManager'),
      getVal('salTeachingStipend'),
      getVal('salGuestLecturer'),
      getVal('salConsultant'),
      getVal('salOther')
    ];
    const subtotalA = salaries.reduce((s, v) => s + v, 0);
    document.getElementById('subtotalA').textContent = formatCurrency(subtotalA);
    document.getElementById('resultSubA').textContent = formatCurrency(subtotalA);

    // Subtotal B - Fringe Benefits
    const fringeRateFT = getVal('fringeRateFT') / 100;
    const fringeRatePT = getVal('fringeRatePT') / 100;
    const fringeFTBase = getVal('fringeFTBase');
    const fringePTBase = getVal('fringePTBase');
    const subtotalB = (fringeFTBase * fringeRateFT) + (fringePTBase * fringeRatePT);
    document.getElementById('subtotalB').textContent = formatCurrency(subtotalB);
    document.getElementById('resultSubB').textContent = formatCurrency(subtotalB);

    // Subtotal C - Travel & Other Direct
    const travelItems = [
      getVal('travelCosts'),
      getVal('adminCosts'),
      getVal('suppliesCosts'),
      getVal('advertisingCosts'),
      getVal('materialsCosts'),
      getVal('foodCosts'),
      getVal('otherDirectCosts')
    ];
    const subtotalC = travelItems.reduce((s, v) => s + v, 0);
    document.getElementById('subtotalC').textContent = formatCurrency(subtotalC);
    document.getElementById('resultSubC').textContent = formatCurrency(subtotalC);

    // Subtotal D - Excluded Direct Costs (manual items)
    const excludedManual = [
      getVal('equipmentRental'),
      getVal('spaceRental'),
      getVal('contractualExpenses'),
      getVal('otherExcluded')
    ].reduce((s, v) => s + v, 0);

    // OGPS fees (auto-calculated, added to Subtotal D)
    let paypalFee = 0;
    let canvasFee = 0;
    let canvasFeePerParticipant = 0;

    if (isOGPS) {
      // PayPal fee: 4% of total revenue if credit card, 0% if wire
      if (paymentMethod === 'credit-card') {
        paypalFee = totalRevenue * 0.04;
        document.getElementById('paypalRateBadge').textContent = '4% (Credit Card)';
      } else {
        paypalFee = 0;
        document.getElementById('paypalRateBadge').textContent = '0% (Wire)';
      }
      document.getElementById('paypalFeeDisplay').textContent = formatCurrency(paypalFee);

      // Canvas fee: lookup based on tuition per participant
      const enrollInfo = getEnrollmentInfo();
      canvasFeePerParticipant = getCanvasFeePerParticipant(enrollInfo.tuitionPerParticipant);
      canvasFee = canvasFeePerParticipant * enrollInfo.totalStudents;

      if (enrollInfo.totalStudents > 0 && canvasFeePerParticipant > 0) {
        document.getElementById('canvasRateBadge').textContent =
          '$' + canvasFeePerParticipant + '/participant \u00D7 ' + enrollInfo.totalStudents;
      } else {
        document.getElementById('canvasRateBadge').textContent = 'Per participant';
      }
      document.getElementById('canvasFeeDisplay').textContent = formatCurrency(canvasFee);

      // Results panel
      document.getElementById('resultPaypalFee').textContent = formatCurrency(paypalFee);
      document.getElementById('resultCanvasFee').textContent = formatCurrency(canvasFee);
    }

    const subtotalD = excludedManual + paypalFee + canvasFee;
    document.getElementById('subtotalD').textContent = formatCurrency(subtotalD);
    document.getElementById('resultSubD').textContent = formatCurrency(subtotalD);

    // Total Direct Costs
    const totalDirectCosts = tuitionRemission + subtotalA + subtotalB + subtotalC + subtotalD;
    document.getElementById('resultDirectCosts').textContent = formatCurrency(totalDirectCosts);

    // Modified Direct Costs (A + B + C only)
    const modifiedDirectCosts = subtotalA + subtotalB + subtotalC;
    document.getElementById('resultMDC').textContent = formatCurrency(modifiedDirectCosts);

    // Indirect Costs
    const idcRate = idcInfo.rate;
    document.getElementById('resultIDCRate').textContent = isDonation ? 'N/A' : (idcRate * 100) + '%';

    let indirectCostsOnMDC = 0;
    let processingFee = 0;
    let totalIndirectCosts = 0;

    if (!isDonation) {
      indirectCostsOnMDC = modifiedDirectCosts * idcRate;
      processingFee = subtotalD * 0.10;
      totalIndirectCosts = indirectCostsOnMDC + processingFee;
    }

    document.getElementById('resultIDC').textContent = formatCurrency(indirectCostsOnMDC);
    document.getElementById('resultProcessingFee').textContent = formatCurrency(processingFee);
    document.getElementById('resultIndirectCosts').textContent = formatCurrency(totalIndirectCosts);

    // Total Costs
    const totalCosts = totalDirectCosts + totalIndirectCosts;
    document.getElementById('resultTotalCosts').textContent = formatCurrency(totalCosts);

    // Net Income
    const netIncome = totalRevenue - totalCosts;
    document.getElementById('resultNetIncome').textContent = formatCurrency(netIncome);

    const netRow = document.getElementById('netIncomeRow');
    if (netIncome < 0) {
      netRow.classList.add('negative');
    } else {
      netRow.classList.remove('negative');
    }

    // KPIs
    const ratio = totalDirectCosts > 0 ? totalRevenue / totalDirectCosts : 0;
    document.getElementById('kpiRatio').textContent = formatRatio(ratio);

    const residualPct = isDonation ? 1.0 : 0.5;
    const residual = netIncome > 0 ? netIncome * residualPct : 0;
    document.getElementById('kpiResidual').textContent = formatCurrency(residual);
    document.getElementById('kpiResidualNote').textContent = isDonation ? '100% of Net Income' : '50% of Net Income';

    const roi = totalCosts > 0 ? netIncome / totalCosts : 0;
    document.getElementById('kpiROI').textContent = formatPercent(roi);

    const margin = totalRevenue > 0 ? netIncome / totalRevenue : 0;
    document.getElementById('kpiMargin').textContent = formatPercent(margin);

    const totalStudents = getTotalStudents();
    const revPerStudent = totalStudents > 0 ? totalRevenue / totalStudents : 0;
    document.getElementById('kpiPerStudent').textContent = formatCurrency(revPerStudent);

    const costPerStudent = totalStudents > 0 ? totalCosts / totalStudents : 0;
    document.getElementById('kpiCostPerStudent').textContent = formatCurrency(costPerStudent);

    const revenuePerStudent = totalStudents > 0 ? totalRevenue / totalStudents : 0;
    const breakevenStudents = revenuePerStudent > 0 ? Math.ceil(totalCosts / revenuePerStudent) : 0;
    document.getElementById('kpiBreakevenStudents').textContent = breakevenStudents.toLocaleString('en-US');
    document.getElementById('kpiBreakevenRevenue').textContent = formatCurrency(totalCosts);
  }

  function getTotalStudents() {
    const revenueMode = getToggleValue('revenueToggle');
    if (revenueMode === 'calculate') {
      return getVal('summerStudents') + getVal('fallStudents') + getVal('springStudents');
    }
    return 0;
  }

  initializeSublineEditors();

  // --- Event Listeners for all inputs ---
  document.querySelectorAll('input[type="number"], input[type="text"]').forEach(input => {
    input.addEventListener('input', recalculate);
  });

  // Initial calculation
  recalculate();

  // --- Helper for exports: gather all computed data ---
  function gatherExportData() {
    const programName = document.getElementById('programName').value || 'Executive Education Program';
    const fiscalYear = document.getElementById('fiscalYear').value || 'FY2026';
    const revenueType = getToggleValue('revenueTypeToggle');
    const isDonation = revenueType === 'donation';
    const isOGPS = getToggleValue('ogpsToggle') === 'yes';
    const paymentMethod = getToggleValue('paymentMethodToggle');
    const idcInfo = getIDCRate();
    const enrollInfo = getEnrollmentInfo();

    const subtotalA = getVal('salProgramManager') + getVal('salTeachingStipend') + getVal('salGuestLecturer') + getVal('salConsultant') + getVal('salOther');
    const fringeFT = getVal('fringeFTBase') * (getVal('fringeRateFT') / 100);
    const fringePT = getVal('fringePTBase') * (getVal('fringeRatePT') / 100);
    const subtotalB = fringeFT + fringePT;
    const subtotalC = getVal('travelCosts') + getVal('adminCosts') + getVal('suppliesCosts') + getVal('advertisingCosts') + getVal('materialsCosts') + getVal('foodCosts') + getVal('otherDirectCosts');

    const excludedManual = getVal('equipmentRental') + getVal('spaceRental') + getVal('contractualExpenses') + getVal('otherExcluded');

    let paypalFee = 0;
    let canvasFee = 0;
    let canvasFeePerParticipant = 0;
    if (isOGPS) {
      if (paymentMethod === 'credit-card') paypalFee = enrollInfo.totalRevenue * 0.04;
      canvasFeePerParticipant = getCanvasFeePerParticipant(enrollInfo.tuitionPerParticipant);
      canvasFee = canvasFeePerParticipant * enrollInfo.totalStudents;
    }

    const subtotalD = excludedManual + paypalFee + canvasFee;
    const totalDirect = getVal('tuitionRemission') + subtotalA + subtotalB + subtotalC + subtotalD;
    const mdc = subtotalA + subtotalB + subtotalC;

    let idcOnMDC = 0, processingFee = 0, totalIndirect = 0;
    if (!isDonation) {
      idcOnMDC = mdc * idcInfo.rate;
      processingFee = subtotalD * 0.10;
      totalIndirect = idcOnMDC + processingFee;
    }

    const totalCosts = totalDirect + totalIndirect;
    const netIncome = enrollInfo.totalRevenue - totalCosts;

    return {
      programName, fiscalYear, revenueType, isDonation, isOGPS, paymentMethod, idcInfo,
      enrollInfo, subtotalA, subtotalB, subtotalC, subtotalD,
      fringeFT, fringePT, excludedManual, paypalFee, canvasFee, canvasFeePerParticipant,
      totalDirect, mdc, idcOnMDC, processingFee, totalIndirect, totalCosts, netIncome,
      sublines: Object.fromEntries(
        Object.keys(SUBLINE_CATEGORIES).map(categoryId => [
          categoryId,
          getMeaningfulSublineItems(categoryId).map(item => ({
            description: item.description.trim() || 'Detail line',
            amount: parseFloat(item.amount) || 0
          }))
        ])
      )
    };
  }

  // --- Export to Excel ---
  document.getElementById('exportExcel').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();
    const d = gatherExportData();

    const wsData = [
      ['Executive Education ROI'],
      ['Instructional Revenue Center - Budget'],
      ['Program:', d.programName],
      ['Fiscal Year:', d.fiscalYear],
      ['Revenue Type:', d.isDonation ? 'Donation' : 'IRC'],
      ['Academic Offering:', getToggleValue('creditToggle') === 'credit' ? 'Credit' : 'Non-Credit'],
      ['Delivery Method:', getToggleValue('deliveryToggle').replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())],
      ['OGPS Partner:', d.isOGPS ? 'Yes' : 'No'],
    ];

    if (!d.isDonation) {
      wsData.push(['IDC Rate:', d.idcInfo.label + ' (' + (d.idcInfo.rate * 100) + '%)']);
    } else {
      wsData.push(['IDC Rate:', 'N/A (Donation)']);
    }

    if (d.isOGPS) {
      wsData.push(['Payment Method:', d.paymentMethod === 'credit-card' ? 'Credit Card' : 'Wire Transfer']);
    }

    wsData.push([]);
    wsData.push(['PROJECTED REVENUE']);

    function pushLineWithSublines(label, categoryId) {
      wsData.push([label, getVal(categoryId)]);
      (d.sublines[categoryId] || []).forEach(item => {
        wsData.push(['   ' + item.description, item.amount]);
      });
    }

    const revenueMode = getToggleValue('revenueToggle');
    if (revenueMode === 'calculate') {
      wsData.push(['Semester', 'Students', 'Courses', 'Credits/Course', 'Tuition Rate', 'Subtotal']);
      ['summer', 'fall', 'spring'].forEach(sem => {
        const cap = sem.charAt(0).toUpperCase() + sem.slice(1);
        const stu = getVal(sem + 'Students');
        const crs = getVal(sem + 'Courses');
        const cred = getVal(sem + 'Credits');
        const rate = getVal(sem + 'Rate');
        wsData.push([cap, stu, crs, cred, rate, stu * crs * cred * rate]);
      });
      wsData.push(['Total Revenue', '', '', '', '', d.enrollInfo.totalRevenue]);
    } else {
      pushLineWithSublines('Total Revenue', 'manualRevenue');
    }

    wsData.push([]);
    wsData.push(['PROJECTED EXPENSES']);
    wsData.push([]);

    wsData.push(['I. Tuition Remission']);
    pushLineWithSublines('Tuition Remission Expense', 'tuitionRemission');
    wsData.push([]);

    wsData.push(['II. Salaries']);
    pushLineWithSublines('Program Manager', 'salProgramManager');
    pushLineWithSublines('Teaching Stipend', 'salTeachingStipend');
    pushLineWithSublines('Guest Lecturer', 'salGuestLecturer');
    pushLineWithSublines('Consultant/Professional Services', 'salConsultant');
    pushLineWithSublines('Other Salaries', 'salOther');
    wsData.push(['Subtotal A (Salaries)', d.subtotalA]);
    wsData.push([]);

    wsData.push(['III. Fringe Benefits']);
    pushLineWithSublines('Full-Time Fringe Base', 'fringeFTBase');
    wsData.push(['Full-Time Fringe (' + getVal('fringeRateFT') + '% on $' + getVal('fringeFTBase').toLocaleString() + ')', d.fringeFT]);
    pushLineWithSublines('Part-Time Fringe Base', 'fringePTBase');
    wsData.push(['Part-Time Fringe (' + getVal('fringeRatePT') + '% on $' + getVal('fringePTBase').toLocaleString() + ')', d.fringePT]);
    wsData.push(['Subtotal B (Fringe Benefits)', d.subtotalB]);
    wsData.push([]);

    wsData.push(['IV. Program Travel & Other Direct Costs']);
    pushLineWithSublines('Travel Costs', 'travelCosts');
    pushLineWithSublines('Administrative Costs', 'adminCosts');
    pushLineWithSublines('General Supplies & Expenses', 'suppliesCosts');
    pushLineWithSublines('Advertising & Publicity', 'advertisingCosts');
    pushLineWithSublines('Classroom Materials', 'materialsCosts');
    pushLineWithSublines('Food Service / Catering', 'foodCosts');
    pushLineWithSublines('Other Direct Costs', 'otherDirectCosts');
    wsData.push(['Subtotal C (Travel & Other Direct)', d.subtotalC]);
    wsData.push([]);

    wsData.push(['Excluded Direct Costs (Not Subject to IDC)']);
    pushLineWithSublines('Equipment Rental', 'equipmentRental');
    pushLineWithSublines('Space Rental', 'spaceRental');
    pushLineWithSublines('Contractual Expenses', 'contractualExpenses');
    pushLineWithSublines('Other Excluded Costs', 'otherExcluded');

    if (d.isOGPS) {
      wsData.push(['PayPal Processing Fee (' + (d.paymentMethod === 'credit-card' ? '4%' : '0%') + ')', d.paypalFee]);
      wsData.push(['Canvas LMS Fee ($' + d.canvasFeePerParticipant + '/participant x ' + d.enrollInfo.totalStudents + ')', d.canvasFee]);
    }

    wsData.push(['Subtotal D (Excluded Direct)', d.subtotalD]);
    wsData.push([]);

    wsData.push(['V. Total Direct Costs', d.totalDirect]);
    wsData.push([]);

    if (!d.isDonation) {
      wsData.push(['VI. Indirect Costs']);
      wsData.push(['Total Modified Direct Costs (A+B+C)', d.mdc]);
      wsData.push(['Indirect Costs on TMDC (' + (d.idcInfo.rate * 100) + '%)', d.idcOnMDC]);
      wsData.push(['Processing Fee (10% on Subtotal D)', d.processingFee]);
      wsData.push(['Total Indirect Costs', d.totalIndirect]);
    } else {
      wsData.push(['VI. Indirect Costs']);
      wsData.push(['Donation - No indirect costs apply', 0]);
    }
    wsData.push([]);

    wsData.push(['VII. Total Costs', d.totalCosts]);
    wsData.push([]);

    wsData.push(['VIII. Net Income/(Loss)', d.netIncome]);
    wsData.push([]);

    const ratio = d.totalDirect > 0 ? d.enrollInfo.totalRevenue / d.totalDirect : 0;
    wsData.push(['IX. Income to Direct Expense Ratio', parseFloat(ratio.toFixed(4))]);
    wsData.push([]);

    const residualPct = d.isDonation ? 1.0 : 0.5;
    const residual = d.netIncome > 0 ? d.netIncome * residualPct : 0;
    wsData.push([`X. Anticipated Residual Return to School (${d.isDonation ? '100%' : '50%'})`, residual]);
    wsData.push([]);

    wsData.push(['ADDITIONAL ROI METRICS']);
    const roi = d.totalCosts > 0 ? d.netIncome / d.totalCosts : 0;
    wsData.push(['ROI Percentage', parseFloat((roi * 100).toFixed(1)) + '%']);
    const margin = d.enrollInfo.totalRevenue > 0 ? d.netIncome / d.enrollInfo.totalRevenue : 0;
    wsData.push(['Profit Margin', parseFloat((margin * 100).toFixed(1)) + '%']);
    if (d.enrollInfo.totalStudents > 0) {
      wsData.push(['Total Enrollment', d.enrollInfo.totalStudents]);
      wsData.push(['Revenue per Student', d.enrollInfo.totalRevenue / d.enrollInfo.totalStudents]);
      wsData.push(['Cost per Student', d.totalCosts / d.enrollInfo.totalStudents]);
      const beStu = (d.enrollInfo.totalRevenue / d.enrollInfo.totalStudents) > 0 ? Math.ceil(d.totalCosts / (d.enrollInfo.totalRevenue / d.enrollInfo.totalStudents)) : 0;
      wsData.push(['Break-Even Enrollment', beStu]);
    }
    wsData.push(['Break-Even Revenue', d.totalCosts]);

    wsData.push([]);
    wsData.push(['NOTES']);
    wsData.push(['Total Modified Direct Costs = Subtotal A + Subtotal B + Subtotal C.']);
    wsData.push(['The indirect cost rate varies based on the IRC program\'s academic offering and location.']);
    wsData.push(['Rates: 50% credit/on-campus; 40% credit/off-campus; 30% noncredit/on-campus; 25% noncredit/off-campus.']);
    wsData.push(['Online programs are subject to off-campus indirect cost rates.']);
    wsData.push(['OGPS Partner Programs are subject to a flat 10% indirect cost rate.']);
    wsData.push(['Donation revenue is not subject to indirect costs.']);
    if (d.isOGPS) {
      wsData.push(['PayPal processing fee: 4% for credit card payments, 0% for wire transfers.']);
      wsData.push(['Canvas LMS fees are per participant based on tuition tier schedule.']);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 52 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Budget');
    XLSX.writeFile(wb, (d.programName || 'IRC_Budget') + '_' + d.fiscalYear + '.xlsx');
  });

  // --- Export to PDF ---
  document.getElementById('exportPDF').addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'letter');
    const d = gatherExportData();

    let y = 15;
    const leftMargin = 15;
    const rightMargin = 195;
    const valueCol = 155;

    function addTitle(text) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(122, 34, 135);
      doc.text(text, leftMargin, y);
      y += 8;
    }

    function addSubtitle(text) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(24, 36, 73);
      doc.text(text, leftMargin, y);
      y += 6;
    }

    function addSectionHeader(text) {
      if (y > 250) { doc.addPage(); y = 15; }
      y += 3;
      doc.setFillColor(122, 34, 135);
      doc.rect(leftMargin, y - 4, rightMargin - leftMargin, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(text, leftMargin + 3, y);
      y += 7;
    }

    function addRow(label, value, bold, indentLevel = 0) {
      if (y > 255) { doc.addPage(); y = 15; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(24, 36, 73);
      doc.text(label, leftMargin + 3 + (indentLevel * 5), y);
      doc.text(String(value), valueCol, y, { align: 'right' });
      y += 5;
    }

    function addTotalRow(label, value) {
      doc.setDrawColor(224, 229, 245);
      doc.line(leftMargin, y - 2, rightMargin, y - 2);
      addRow(label, value, true);
      y += 1;
    }

    function addDivider() {
      y += 2;
      doc.setDrawColor(224, 229, 245);
      doc.line(leftMargin, y, rightMargin, y);
      y += 4;
    }

    function addLineWithSublines(label, categoryId, indentLevel = 1) {
      const details = d.sublines[categoryId] || [];
      if (getVal(categoryId) <= 0 && details.length === 0) return;
      addRow(label, formatCurrency(getVal(categoryId)), false, indentLevel);
      details.forEach(item => {
        addRow(item.description, formatCurrency(item.amount), false, indentLevel + 1);
      });
    }

    // Header
    addTitle('Executive Education ROI');
    addSubtitle('Instructional Revenue Center - Budget');
    y += 2;

    // Program Info
    addRow('Program:', d.programName, true);
    addRow('Fiscal Year:', d.fiscalYear, false);
    addRow('Revenue Type:', d.isDonation ? 'Donation' : 'IRC', false);
    addRow('Academic Offering:', getToggleValue('creditToggle') === 'credit' ? 'Credit' : 'Non-Credit', false);
    addRow('Delivery Method:', getToggleValue('deliveryToggle').replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()), false);
    addRow('OGPS Partner:', d.isOGPS ? 'Yes' : 'No', false);
    if (!d.isDonation) {
      addRow('IDC Rate:', d.idcInfo.label + ' (' + (d.idcInfo.rate * 100) + '%)', false);
    } else {
      addRow('IDC Rate:', 'N/A (Donation)', false);
    }
    if (d.isOGPS) {
      addRow('Payment Method:', d.paymentMethod === 'credit-card' ? 'Credit Card' : 'Wire Transfer', false);
    }

    // Revenue
    addSectionHeader('PROJECTED REVENUE');
    const revenueMode = getToggleValue('revenueToggle');
    if (revenueMode === 'calculate') {
      ['summer', 'fall', 'spring'].forEach(sem => {
        const cap = sem.charAt(0).toUpperCase() + sem.slice(1);
        const stu = getVal(sem + 'Students');
        const crs = getVal(sem + 'Courses');
        const cred = getVal(sem + 'Credits');
        const rate = getVal(sem + 'Rate');
        const sub = stu * crs * cred * rate;
        if (stu > 0) {
          addRow(cap + ' (' + stu + ' students x ' + crs + ' courses x ' + cred + ' cr x $' + rate.toLocaleString() + ')', formatCurrency(sub), false);
        }
      });
      addTotalRow('Total Revenue', formatCurrency(d.enrollInfo.totalRevenue));
    } else {
      addTotalRow('Total Revenue', formatCurrency(d.enrollInfo.totalRevenue));
      (d.sublines.manualRevenue || []).forEach(item => {
        addRow(item.description, formatCurrency(item.amount), false, 1);
      });
    }

    // Expenses
    addSectionHeader('PROJECTED EXPENSES');

    addRow('I. Tuition Remission', formatCurrency(getVal('tuitionRemission')), true);
    (d.sublines.tuitionRemission || []).forEach(item => {
      addRow(item.description, formatCurrency(item.amount), false, 1);
    });
    addDivider();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(24, 36, 73);
    doc.text('II. Salaries', leftMargin + 3, y); y += 5;
    addLineWithSublines('Program Manager', 'salProgramManager');
    addLineWithSublines('Teaching Stipend', 'salTeachingStipend');
    addLineWithSublines('Guest Lecturer', 'salGuestLecturer');
    addLineWithSublines('Consultant/Professional Services', 'salConsultant');
    addLineWithSublines('Other Salaries', 'salOther');
    addTotalRow('Subtotal A (Salaries)', formatCurrency(d.subtotalA));

    doc.setFont('helvetica', 'bold');
    doc.text('III. Fringe Benefits', leftMargin + 3, y); y += 5;
    addLineWithSublines('Full-Time Fringe Base', 'fringeFTBase');
    if (d.fringeFT > 0) addRow('Full-Time Fringe (' + getVal('fringeRateFT') + '%)', formatCurrency(d.fringeFT), false, 1);
    addLineWithSublines('Part-Time Fringe Base', 'fringePTBase');
    if (d.fringePT > 0) addRow('Part-Time Fringe (' + getVal('fringeRatePT') + '%)', formatCurrency(d.fringePT), false, 1);
    addTotalRow('Subtotal B (Fringe Benefits)', formatCurrency(d.subtotalB));

    doc.setFont('helvetica', 'bold');
    doc.text('IV. Program Travel & Other Direct Costs', leftMargin + 3, y); y += 5;
    addLineWithSublines('Travel Costs', 'travelCosts');
    addLineWithSublines('Administrative Costs', 'adminCosts');
    addLineWithSublines('General Supplies', 'suppliesCosts');
    addLineWithSublines('Advertising & Publicity', 'advertisingCosts');
    addLineWithSublines('Classroom Materials', 'materialsCosts');
    addLineWithSublines('Food Service', 'foodCosts');
    addLineWithSublines('Other Direct Costs', 'otherDirectCosts');
    addTotalRow('Subtotal C (Travel & Other Direct)', formatCurrency(d.subtotalC));

    // Excluded + OGPS fees
    doc.setFont('helvetica', 'bold');
    doc.text('Excluded Direct Costs', leftMargin + 3, y); y += 5;
    addLineWithSublines('Equipment Rental', 'equipmentRental');
    addLineWithSublines('Space Rental', 'spaceRental');
    addLineWithSublines('Contractual Expenses', 'contractualExpenses');
    addLineWithSublines('Other Excluded', 'otherExcluded');
    if (d.isOGPS) {
      addRow('PayPal Fee (' + (d.paymentMethod === 'credit-card' ? '4%' : '0%') + ')', formatCurrency(d.paypalFee), false, 1);
      addRow('Canvas LMS Fee ($' + d.canvasFeePerParticipant + '/participant)', formatCurrency(d.canvasFee), false, 1);
    }
    addTotalRow('Subtotal D (Excluded Direct)', formatCurrency(d.subtotalD));

    // Cost summary
    addSectionHeader('COST SUMMARY');
    addRow('V. Total Direct Costs', formatCurrency(d.totalDirect), true);

    if (!d.isDonation) {
      addRow('   Modified Direct Costs (A+B+C)', formatCurrency(d.mdc), false);
      addRow('   Indirect Costs (' + (d.idcInfo.rate * 100) + '% on TMDC)', formatCurrency(d.idcOnMDC), false);
      addRow('   Processing Fee (10% on Subtotal D)', formatCurrency(d.processingFee), false);
      addTotalRow('VI. Total Indirect Costs', formatCurrency(d.totalIndirect));
    } else {
      addRow('VI. Indirect Costs', 'N/A (Donation)', false);
    }

    addTotalRow('VII. Total Costs', formatCurrency(d.totalCosts));
    y += 2;

    addSectionHeader('NET INCOME & KEY METRICS');
    addRow('VIII. Net Income/(Loss)', formatCurrency(d.netIncome), true);

    const ratio = d.totalDirect > 0 ? d.enrollInfo.totalRevenue / d.totalDirect : 0;
    addRow('IX. Income to Direct Expense Ratio', formatRatio(ratio), true);

    const residualPctPdf = d.isDonation ? 1.0 : 0.5;
    const residual = d.netIncome > 0 ? d.netIncome * residualPctPdf : 0;
    addRow(`X. Anticipated Residual Return to School (${d.isDonation ? '100%' : '50%'})`, formatCurrency(residual), true);

    addDivider();
    const roiPct = d.totalCosts > 0 ? d.netIncome / d.totalCosts : 0;
    addRow('ROI Percentage', formatPercent(roiPct), false);
    const marginPct = d.enrollInfo.totalRevenue > 0 ? d.netIncome / d.enrollInfo.totalRevenue : 0;
    addRow('Profit Margin', formatPercent(marginPct), false);

    if (d.enrollInfo.totalStudents > 0) {
      addRow('Total Enrollment', d.enrollInfo.totalStudents.toString(), false);
      addRow('Revenue per Student', formatCurrency(d.enrollInfo.totalRevenue / d.enrollInfo.totalStudents), false);
      addRow('Cost per Student', formatCurrency(d.totalCosts / d.enrollInfo.totalStudents), false);
      const beStu = (d.enrollInfo.totalRevenue / d.enrollInfo.totalStudents) > 0 ? Math.ceil(d.totalCosts / (d.enrollInfo.totalRevenue / d.enrollInfo.totalStudents)) : 0;
      addRow('Break-Even Enrollment', beStu.toString(), false);
    }
    addRow('Break-Even Revenue', formatCurrency(d.totalCosts), false);

    // Notes
    y += 5;
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(24, 36, 73);
    const notes = [
      'Total Modified Direct Costs = Subtotal A + Subtotal B + Subtotal C.',
      'IDC Rates: 50% credit/on-campus; 40% credit/off-campus; 30% noncredit/on-campus; 25% noncredit/off-campus.',
      'Online programs are subject to off-campus indirect cost rates. OGPS Partner Programs: flat 10% IDC rate.',
      'Donation revenue is not subject to indirect costs.',
    ];
    if (d.isOGPS) {
      notes.push('PayPal processing fee: 4% for credit card, 0% for wire transfer. Canvas LMS fees per participant by tuition tier.');
    }
    notes.forEach(n => {
      doc.text(n, leftMargin, y);
      y += 4;
    });

    doc.save((d.programName || 'IRC_Budget') + '_' + d.fiscalYear + '.pdf');
  });

})();
