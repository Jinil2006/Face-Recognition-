/* ===================================
   Admin Panel JavaScript
   =================================== */

$(document).ready(function() {
    // Initialize Admin Panel
    initAdmin();
    
    // Theme Toggle
    initTheme();
    
    // Navigation
    initNavigation();
    
    // Mobile Menu
    initMobileMenu();
    
    // Form Submissions
    initForms();
    
    // Search Functionality
    initSearch();
    
    // Copy Credentials
    initCopyFunction();
    
    // Load Data
    loadDashboardStats();
    loadFacultyList();
    loadBatchList();
    loadSubjectList();
    loadTimetableOptions();
    loadTimetableDisplay();
    
    // Initialize Tooltips
    initTooltips();
});

// ==================== INITIALIZATION ====================

function initAdmin() {
    // Set default date for date inputs
    const today = new Date().toISOString().split('T')[0];
    
    // Check if admin is logged in
    console.log('Admin Panel Initialized');
    
    // Display flash messages as toasts
    displayFlashMessages();
}

// Display flash messages as toast notifications
function displayFlashMessages() {
    const flashDataContainer = $('#flashMessagesData');
    
    if (flashDataContainer.length) {
        const messages = flashDataContainer.find('div[data-category]');
        
        messages.each(function() {
            const category = $(this).data('category');
            const message = $(this).data('message');
            
            if (category && message) {
                // Set title based on category
                let title = 'Message';
                if (category === 'success') title = 'Success';
                else if (category === 'error') title = 'Error';
                else if (category === 'warning') title = 'Warning';
                else if (category === 'info') title = 'Info';
                
                // Show toast notification
                showToast(category, title, message);
            }
        });
        
        // Remove the hidden container after processing
        flashDataContainer.remove();
    }
}

// ==================== THEME TOGGLE ====================
function initTheme() {
    var isLight = false;
    
    // Function to update all theme toggle buttons
    function updateThemeButtons() {
        if (isLight) {
            $('.theme-toggle, .mobile-theme-toggle').find('i').removeClass('fa-sun').addClass('fa-moon');
        } else {
            $('.theme-toggle, .mobile-theme-toggle').find('i').removeClass('fa-moon').addClass('fa-sun');
        }
    }
    
    // Load saved theme
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        isLight = true;
        $('body').addClass('light-theme');
        updateThemeButtons();
    }
    
    // Theme toggle for all theme buttons
    $('body').on('click', '.theme-toggle, .mobile-theme-toggle', function(e) {
        e.preventDefault();
        isLight = !isLight;
        $('body').toggleClass('light-theme', isLight);
        updateThemeButtons();
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

function initNavigation() {
    // Tab navigation
    $('.sidebar-nav .nav-item').on('click', function(e) {
        if ($(this).hasClass('logout')) return;
        
        e.preventDefault();
        const tabId = $(this).data('tab');
        
        // Update nav active state
        $('.sidebar-nav .nav-item').removeClass('active');
        $(this).addClass('active');
        
        // Show corresponding tab
        $('.tab-content').removeClass('active');
        $('#' + tabId).addClass('active');
        
        // Close mobile menu if open
        $('#sidebar').removeClass('open');
        $('#sidebarOverlay').removeClass('show');
    });
    
    // Quick action buttons
    $('.action-btn').on('click', function() {
        const tabId = $(this).data('tab');
        
        // Update nav
        $('.sidebar-nav .nav-item').removeClass('active');
        $('.sidebar-nav .nav-item[data-tab="' + tabId + '"]').addClass('active');
        
        // Show tab
        $('.tab-content').removeClass('active');
        $('#' + tabId).addClass('active');
    });
}

function initMobileMenu() {
    $('#hamburgerMenu').on('click', function() {
        $('#sidebar').toggleClass('open');
        $('#sidebarOverlay').toggleClass('show');
        
        // Toggle icon between bars and times
        const icon = $(this).find('i');
        if ($('#sidebar').hasClass('open')) {
            // icon.removeClass('fa-bars').addClass('fa-times');
        }
    });
    
    $('#sidebarOverlay').on('click', function() {
        $('#sidebar').removeClass('open');
        $(this).removeClass('show');
        // Reset icon
        // $('#hamburgerMenu').find('i').removeClass('fa-times').addClass('fa-bars');
    });
}

// ==================== DATA MANAGEMENT ====================

// LocalStorage Keys
const STORAGE_KEYS = {
    FACULTY: 'admin_faculty_data',
    BATCHES: 'admin_batch_data',
    SUBJECTS: 'admin_subject_data',
    TIMETABLE: 'admin_timetable_data'
};

// Get data from localStorage
function getData(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

// Save data to localStorage
function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Generate unique ID
function generateUniqueId(prefix, existingData) {
    const count = existingData.length + 1;
    const year = new Date().getFullYear();
    return `${prefix.toUpperCase()}${year}${count.toString().padStart(3, '0')}`;
}

// Generate random password
function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}


// ==================== FACULTY MANAGEMENT ====================

function initForms() {
    // Download template button handler
    $('#downloadTemplateBtn').on('click', function() {
        // Create a temporary link to download the template
        const link = document.createElement('a');
        link.href = '/download_template';
        link.download = 'student_template.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('success', 'Template Download', 'Template file downloaded successfully');
    });
    
    // File input change handler - show preview (Vanilla JS)
    const batchExcelFile = document.getElementById('batchExcelFile');
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const removeFile = document.getElementById('removeFile');
    const uploadedFileSection = document.getElementById('uploadedFileSection');
    
    if (batchExcelFile) {
        batchExcelFile.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                if (fileName) fileName.textContent = file.name;
                if (filePreview) filePreview.style.display = 'flex';
            }
        });
    }
    
    // Remove file button handler (Vanilla JS)
    if (removeFile) {
        removeFile.addEventListener('click', function() {
            if (batchExcelFile) batchExcelFile.value = '';
            if (filePreview) filePreview.style.display = 'none';
            // if (uploadedFileSection) uploadedFileSection.style.display = 'none';
        });
    }
    
    // File upload form - AJAX submission with toast notification
    const importBatchForm = document.getElementById('importBatchForm');
    if (importBatchForm) {
        importBatchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('batchExcelFile');
            if (!fileInput || !fileInput.files[0]) {
                showToast('error', 'No File Selected', 'Please select an Excel file to upload');
                return;
            }
            
            const formData = new FormData(this);
            const submitBtn = importBatchForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Upload';
            
            // Show loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            }
            
            fetch('/upload_students', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success toast
                    showToast('success', 'File Uploaded Successfully', data.message || `File "${fileInput.files[0].name}" has been uploaded`);
                    
                    // Reset form
                    importBatchForm.reset();
                    if (filePreview) filePreview.style.display = 'none';
                    
                    // Reload the page after a short delay to show the uploaded data
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    showToast('error', 'Upload Failed', data.message || 'There was an error uploading the file');
                }
            })
            .catch(error => {
                console.error('Upload error:', error);
                showToast('error', 'Upload Failed', 'Network error occurred during upload');
            })
            .finally(() => {
                // Reset button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            });
        });
    }
    
    // Check if there's uploaded data from server and show the section
    const recordCount = document.getElementById('recordCount');
    if (uploadedFileSection && recordCount) {
        const countText = recordCount.textContent;
        if (countText && countText !== '0 records') {
            uploadedFileSection.style.display = 'block';
        }
    }
    
    // Add Subject Form
    $('#addSubjectForm').on('submit', function(e) {
        e.preventDefault();
        
        const code = $('#subjectCode').val().trim().toUpperCase();
        const name = $('#subjectName').val().trim();
        const department = $('#subjectDepartment').val();
        const semester = $('#subjectSemester').val();
        const type = $('#subjectType').val();
        const credits = parseInt($('#subjectCredits').val()) || 3;
        
        if (!code || !name || !department || !semester || !type) {
            showToast('error', 'Validation Error', 'Please fill in all required fields');
            return;
        }
        
        const subjectData = getData(STORAGE_KEYS.SUBJECTS);
        
        // Check if subject code exists
        const exists = subjectData.some(s => s.code === code);
        
        if (exists) {
            showToast('error', 'Duplicate Entry', 'Subject with this code already exists');
            return;
        }
        
        const newSubject = {
            id: `SUB${subjectData.length + 1}`,
            code: code,
            name: name,
            department: department,
            semester: semester,
            type: type,
            credits: credits,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        
        subjectData.push(newSubject);
        saveData(STORAGE_KEYS.SUBJECTS, subjectData);
        
        // Clear form
        $('#addSubjectForm')[0].reset();
        
        // Reload
        loadSubjectList();
        loadTimetableOptions();
        loadTimetableDisplay();
        
        showToast('success', 'Subject Added', 'New subject has been added successfully');
    });
    
    // Timetable Form - Submit to server
    $('#timetableForm').on('submit', function(e) {
        e.preventDefault();
        
        const classValue = $('#timetableClass').val();
        const day = $('#timetableDay').val();
        const slot = $('#timetableSlot').val();
        const subject = $('#timetableSubject').val();
        const faculty = $('#timetableFaculty').val();
        
        if (!classValue || !day || !slot || !subject || !faculty) {
            showToast('error', 'Validation Error', 'Please fill in all required fields');
            return;
        }
        
        // Submit form to server via AJAX
        const formData = {
            class_name: classValue,
            day: day,
            lecture_no: slot,
            subject: subject,
            faculty_id: faculty
        };
        
        $.ajax({
            url: '/add_timetable',
            method: 'POST',
            data: formData,
            success: function(response) {
                showToast('success', 'Lecture Added', 'Timetable entry has been saved to database');
                $('#timetableForm')[0].reset();
                // Reload timetable display if needed
                loadTimetableDisplay();
            },
            error: function(xhr, status, error) {
                showToast('error', 'Error', 'Failed to save timetable entry: ' + error);
            }
        });
    });
    
    // Timetable View Filters
    $('#viewBatch, #viewSemester, #viewClass').on('change', function() {
        loadTimetableDisplay();
    });
    
    // Generate Report
    $('#generateReport').on('click', function() {
        showToast('info', 'Generating Report', 'Please wait...');
        setTimeout(() => {
            showToast('success', 'Report Ready', 'Report has been generated');
        }, 1000);
    });
}

// ==================== LOAD DATA FUNCTIONS ====================

function loadFacultyList() {
    const faculty = getData(STORAGE_KEYS.FACULTY);
    const tbody = $('#facultyTableBody');
    const empty = $('#facultyEmpty');
    
    if (faculty.length === 0) {
        tbody.empty();
        empty.show();
        return;
    }
    
    empty.hide();
    
    tbody.empty();
    
    faculty.forEach(f => {
        const deptName = getDepartmentName(f.department);
        const roleBadge = f.role === 'mentor' 
            ? '<span class="badge badge-purple">Mentor</span>' 
            : '<span class="badge badge-blue">Faculty</span>';
        
        const row = `
            <tr>
                <td><strong>${f.userId}</strong></td>
                <td>${f.fullName || f.firstName + ' ' + f.lastName}</td>
                <td>${roleBadge}</td>
                <td>${deptName}</td>
                <td>${capitalizeFirst(f.designation)}</td>
                <td>${f.email}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-icon edit" title="Edit" data-id="${f.userId}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-icon delete" title="Delete" data-id="${f.userId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
    
    // Add delete handlers
    $('.action-icon.delete').on('click', function() {
        const id = $(this).data('id');
        deleteFaculty(id);
    });
}

function loadBatchList() {
    const batches = getData(STORAGE_KEYS.BATCHES);
    const faculty = getData(STORAGE_KEYS.FACULTY);
    const tbody = $('#batchTableBody');
    const empty = $('#batchEmpty');
    
    // Check if table elements exist (batch section may not have table if using Excel import only)
    if (tbody.length === 0 || empty.length === 0) {
        return;
    }
    
    if (batches.length === 0) {
        tbody.empty();
        empty.show();
        return;
    }
    
    empty.hide();
    tbody.empty();
    
    batches.forEach(b => {
        const mentor = faculty.find(f => f.userId === b.mentorId);
        const mentorName = mentor ? mentor.fullName || `${mentor.firstName} ${mentor.lastName}` : 'Not Assigned';
        
        const statusBadge = b.status === 'active'
            ? '<span class="status-badge active">Active</span>'
            : '<span class="status-badge inactive">Inactive</span>';
        
        const row = `
            <tr>
                <td><strong>${b.id}</strong></td>
                <td>${b.batchYear}-${parseInt(b.batchYear) + 4}</td>
                <td>${getDepartmentName(b.department)}</td>
                <td>${b.section.toUpperCase()}</td>
                <td>Semester ${b.semester}</td>
                <td>${mentorName}</td>
                <td>${b.studentCount}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-icon edit" title="Edit" data-id="${b.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-icon delete" title="Delete" data-id="${b.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
    
    // Add delete handlers
    $('.action-icon.delete').on('click', function() {
        const id = $(this).data('id');
        deleteBatch(id);
    });
}

function loadSubjectList() {
    const subjects = getData(STORAGE_KEYS.SUBJECTS);
    const tbody = $('#subjectTableBody');
    const empty = $('#subjectEmpty');
    
    if (subjects.length === 0) {
        tbody.empty();
        empty.show();
        return;
    }
    
    empty.hide();
    tbody.empty();
    
    subjects.forEach(s => {
        const typeBadge = getTypeBadge(s.type);
        
        const row = `
            <tr>
                <td><strong>${s.code}</strong></td>
                <td>${s.name}</td>
                <td>${getDepartmentName(s.department)}</td>
                <td>Semester ${s.semester}</td>
                <td>${typeBadge}</td>
                <td>${s.credits}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-icon edit" title="Edit" data-id="${s.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-icon delete" title="Delete" data-id="${s.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
    
    // Add delete handlers
    $('.action-icon.delete').on('click', function() {
        const id = $(this).data('id');
        deleteSubject(id);
    });
}

function loadTimetableOptions() {
    // Load classes (batch-semester) into dropdown
    const batches = getData(STORAGE_KEYS.BATCHES);
    const timetableClass = $('#timetableClass');
    const viewBatch = $('#viewBatch');
    const batchMentor = $('#batchMentor');
    
    // Only add default option if dropdown is empty (preserve Jinja2 template options)
    if (timetableClass.children('option').length <= 1) {
        timetableClass.empty().append('<option value="">Select Class</option>');
    }
    if (viewBatch.children('option').length <= 1) {
        viewBatch.empty().append('<option value="">Select Batch</option>');
    }
    
    // Add batch-based class options from localStorage
    batches.forEach(b => {
        const label = `${b.batchYear}-${parseInt(b.batchYear) + 4} - ${getDepartmentName(b.department)} - Section ${b.section.toUpperCase()}`;
        // Create class options for each semester (1-8)
        for (let sem = 1; sem <= 8; sem++) {
            const classValue = `${b.id}-${sem}`;
            const classLabel = `${label} - Semester ${sem}`;
            timetableClass.append(`<option value="${classValue}">${classLabel}</option>`);
        }
        viewBatch.append(`<option value="${b.id}">${label}</option>`);
    });
    
    // Load faculty into dropdowns
    const faculty = getData(STORAGE_KEYS.FACULTY);
    const timetableFaculty = $('#timetableFaculty');
    
    timetableFaculty.empty().append('<option value="">Select Faculty</option>');
    
    faculty.forEach(f => {
        const label = `${f.fullName || f.firstName + ' ' + f.lastName} - ${f.designation || ''} (${getDepartmentName(f.department)})`;
        timetableFaculty.append(`<option value="${f.userId}">${label}</option>`);
    });
    
    // Add mentors to batch assignment dropdown
    const mentors = faculty.filter(f => f.role === 'mentor');
    batchMentor.empty().append('<option value="">Select Mentor</option>');
    mentors.forEach(m => {
        batchMentor.append(`<option value="${m.userId}">${m.fullName || m.firstName + ' ' + m.lastName}</option>`);
    });
    
    // Load subjects into dropdown
    const subjects = getData(STORAGE_KEYS.SUBJECTS);
    const timetableSubject = $('#timetableSubject');
    
    timetableSubject.empty().append('<option value="">Select Subject</option>');
    
    subjects.forEach(s => {
        timetableSubject.append(`<option value="${s.id}">${s.code} - ${s.name}</option>`);
    });
}

function loadTimetableDisplay() {
    const batchId = $('#viewBatch').val();
    const classId = $('#viewClass').val(); // Class from mentors table (e.g., "6A", "4B")
    
    // Fetch timetable data from server
    $.ajax({
        url: '/api/timetable',
        method: 'GET',
        data: classId ? { class_name: classId } : {},
        success: function(timetableData) {
            // Clear all cells
            $('.lecture-cell').empty();
            
            if (!classId && !batchId) {
                // Show all timetables
                return;
            }
            
            // Filter by batch or class
            let filteredData = timetableData;
            if (batchId) {
                filteredData = filteredData.filter(t => t.batch === batchId);
            }
            if (classId) {
                filteredData = filteredData.filter(t => t.class_name === classId);
            }
            
            filteredData.forEach(entry => {
                // Map lecture_no to slot (1->1, 2->2, etc.)
                const slot = entry.lecture_no;
                const cell = $(`.lecture-cell[data-day="${entry.day}"][data-slot="${slot}"]`);
                
                if (cell.length) {
                    const content = `
                        <div class="lecture-info theory">
                            <strong>${entry.subject}</strong>
                            <span>${entry.faculty_name}</span>
                        </div>
                    `;
                    cell.html(content);
                }
            });
        },
        error: function(xhr, status, error) {
            console.error('Error loading timetable:', error);
            showToast('error', 'Error', 'Failed to load timetable data');
        }
    });
}

// ==================== DELETE FUNCTIONS ====================

function deleteFaculty(id) {
    showConfirmModal('Are you sure you want to delete this faculty member?', function() {
        let faculty = getData(STORAGE_KEYS.FACULTY);
        faculty = faculty.filter(f => f.userId !== id);
        saveData(STORAGE_KEYS.FACULTY, faculty);
        
        loadFacultyList();
        loadDashboardStats();
        loadTimetableOptions();
        loadTimetableDisplay();
        
        showToast('success', 'Deleted', 'Faculty member has been removed');
    });
}

function deleteBatch(id) {
    showConfirmModal('Are you sure you want to delete this batch?', function() {
        let batches = getData(STORAGE_KEYS.BATCHES);
        batches = batches.filter(b => b.id !== id);
        saveData(STORAGE_KEYS.BATCHES, batches);
        
        loadBatchList();
        loadDashboardStats();
        loadTimetableOptions();
        loadTimetableDisplay();
        
        showToast('success', 'Deleted', 'Batch has been removed');
    });
}

function deleteSubject(id) {
    showConfirmModal('Are you sure you want to delete this subject?', function() {
        let subjects = getData(STORAGE_KEYS.SUBJECTS);
        subjects = subjects.filter(s => s.id !== id);
        saveData(STORAGE_KEYS.SUBJECTS, subjects);
        
        loadSubjectList();
        loadTimetableOptions();
        loadTimetableDisplay();
        
        showToast('success', 'Deleted', 'Subject has been removed');
    });
}

// ==================== SEARCH FUNCTIONS ====================

function initSearch() {
    // Faculty Search
    $('#facultySearch').on('input', function() {
        const query = $(this).val().toLowerCase();
        const rows = $('#facultyTableBody tr');
        
        rows.each(function() {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(query));
        });
    });
    
    // Mentor Search
    $('#mentorSearch').on('input', function() {
        const query = $(this).val().toLowerCase();
        const rows = $('#mentorTableBody tr');
        
        rows.each(function() {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(query));
        });
    });
    
    // Batch Search
    $('#batchSearch').on('input', function() {
        const query = $(this).val().toLowerCase();
        const rows = $('#batchTableBody tr');
        
        rows.each(function() {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(query));
        });
    });
    
    // Subject Search
    $('#subjectSearch').on('input', function() {
        const query = $(this).val().toLowerCase();
        const rows = $('#subjectTableBody tr');
        
        rows.each(function() {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(query));
        });
    });
}

// ==================== UTILITY FUNCTIONS ====================

function getDepartmentName(code) {
    const departments = {
        'cse': 'Computer Science',
        'ece': 'Electronics',
        'mech': 'Mechanical',
        'civil': 'Civil Engineering',
        'eee': 'Electrical'
    };
    return departments[code] || code;
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function getTypeBadge(type) {
    const badges = {
        'theory': '<span class="badge badge-blue">Theory</span>',
        'lab': '<span class="badge badge-green">Lab</span>',
        'tutorial': '<span class="badge badge-purple">Tutorial</span>'
    };
    return badges[type] || type;
}

function initCopyFunction() {
    $(document).on('click', '.copy-btn', function() {
        const targetId = $(this).data('copy');
        const text = $('#' + targetId).text();
        
        navigator.clipboard.writeText(text).then(function() {
            showToast('success', 'Copied', 'Text copied to clipboard');
        }, function() {
            showToast('error', 'Error', 'Failed to copy text');
        });
    });
}

function initTooltips() {
    // Add tooltip initialization if needed
    $(document).on('mouseenter', '[title]', function() {
        // Tooltip logic can be added here
    });
}

// ==================== TOAST NOTIFICATIONS ====================

function showToast(type, title, message) {
    const container = $('#toastContainer');
    const toast = $(`
        <div class="toast toast-${type}">
            <div class="toast-icon">
                <i class="fas fa-${getToastIcon(type)}"></i>
            </div>
            <div class="toast-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        </div>
    `);
    
    container.append(toast);
    
    // Show toast
    setTimeout(() => toast.addClass('show'), 10);
    
    // Auto hide
    setTimeout(() => {
        toast.removeClass('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
    
    // Manual close
    toast.find('.toast-close').on('click', function() {
        toast.removeClass('show');
        setTimeout(() => toast.remove(), 300);
    });
}

function getToastIcon(type) {

    const icons = {
        success: 'check-circle',
        danger: 'exclamation-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };

    return icons[type] || 'info-circle';
}

// ==================== MODAL FUNCTIONS ====================

function showConfirmModal(message, callback) {
    const modal = $('#confirmModal');
    $('#modalMessage').text(message);
    
    modal.addClass('show');
    
    $('#modalConfirm').off('click').on('click', function() {
        modal.removeClass('show');
        if (callback) callback();
    });
    
    $('#modalCancel, #modalClose').off('click').on('click', function() {
        modal.removeClass('show');
    });
    
    modal.off('click').on('click', function(e) {
        if (e.target === modal[0]) {
            modal.removeClass('show');
        }
    });
}


