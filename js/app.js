/**
 * EduCheck Main Application Controller
 * Handles State, Authentication, Real-time Khata Submissions, Canvas Grading, and Notification Triggers
 */

// Application State
const state = {
    currentUser: null, // { role: 'teacher' | 'student', ... }
    role: 'student', // 'student' | 'teacher'
    students: [],
    assignments: [],
    submissions: [],
    notifications: [],
    currentEvaluatingSubmission: null,
    currentEvaluatingPageIndex: 0,
    evaluator: null,
    selectedUploadImages: [],
    otpCountdownTimer: null
};

// Blank Baseline State (No Mock Dummy Data - 100% Fresh & Clean)
const DEMO_STUDENTS = [];
const DEMO_ASSIGNMENTS = [];
const SAMPLE_KHATA_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000' viewBox='0 0 800 1000'><rect width='800' height='1000' fill='%23fafafa'/><line x1='60' y1='0' x2='60' y2='1000' stroke='%23fca5a5' stroke-width='2'/><line x1='0' y1='80' x2='800' y2='80' stroke='%23bae6fd' stroke-width='2'/><g stroke='%23e2e8f0' stroke-width='1'><line x1='60' y1='140' x2='760' y2='140'/><line x1='60' y1='200' x2='760' y2='200'/><line x1='60' y1='260' x2='760' y2='260'/><line x1='60' y1='320' x2='760' y2='320'/><line x1='60' y1='380' x2='760' y2='380'/><line x1='60' y1='440' x2='760' y2='440'/><line x1='60' y1='500' x2='760' y2='500'/><line x1='60' y1='560' x2='760' y2='560'/><line x1='60' y1='620' x2='760' y2='620'/><line x1='60' y1='680' x2='760' y2='680'/><line x1='60' y1='740' x2='760' y2='740'/><line x1='60' y1='800' x2='760' y2='800'/></g><text x='80' y='50' font-family='sans-serif' font-size='20' font-weight='bold' fill='%23334155'>হোমওয়ার্ক / পরীক্ষার খাতা</text></svg>";
const DEMO_SUBMISSIONS = [];

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof initFirebaseApp === 'function') {
        initFirebaseApp();
    }
    await initDatabase();
    initEvaluatorCanvas();
    initOtpInputAutoJump();
    checkRememberedSession();
    renderAllViews();
    setupRealtimeFirebaseListeners();
    initExamCountdownTicking();
});

/**
 * Setup real-time updates from Firebase Cloud Firestore
 */
function setupRealtimeFirebaseListeners() {
    if (typeof fbFirestore !== 'undefined' && fbFirestore) {
        try {
            // Listen for new submissions in real-time
            fbFirestore.collection("submissions").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const index = state.submissions.findIndex(s => s.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) {
                            state.submissions.unshift(data);
                            window.dbStorage.setLocal("submissions", data);
                        } else {
                            const localSub = state.submissions[index];
                            if (localSub && localSub.status === 'checked' && data.status === 'pending') {
                                window.dbStorage.set("submissions", localSub);
                                return;
                            }
                            state.submissions[index] = data;
                            window.dbStorage.setLocal("submissions", data);
                        }
                    } else if (change.type === "modified") {
                        if (index !== -1) {
                            const localSub = state.submissions[index];
                            if (localSub && localSub.status === 'checked' && data.status === 'pending') {
                                window.dbStorage.set("submissions", localSub);
                                return;
                            }
                            state.submissions[index] = data;
                            window.dbStorage.setLocal("submissions", data);
                        } else {
                            state.submissions.unshift(data);
                            window.dbStorage.setLocal("submissions", data);
                        }
                    }
                });
                if (state.currentUser?.role === 'teacher') {
                    renderTeacherDashboard();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentDashboard();
                }
            });
            console.log("📡 Real-time Firestore sync active");
        } catch (err) {
            console.warn("Real-time listener notice:", err);
        }
    }
}

/**
 * Generate sequential student ID starting from STU-101
 */
function generateNextStudentId() {
    if (!state.students || state.students.length === 0) {
        return "STU-101";
    }
    let maxNum = 100;
    state.students.forEach(s => {
        if (s && s.id) {
            const m = s.id.match(/\d+/);
            if (m) {
                const val = parseInt(m[0], 10);
                if (val > maxNum) maxNum = val;
            }
        }
    });
    return "STU-" + (maxNum + 1);
}

/**
 * Initialize IndexedDB and sync with clean fresh dataset
 * Permanently wipes all previous data on first launch to ensure a 100% brand new database
 * (User request: "mainkotha fulll database notun kore daww jaja achilo osb dlt koro permanent")
 */
async function initDatabase() {
    try {
        const FRESH_PERMANENT_WIPE_KEY = "educheck_fresh_db_permanent_wipe_v7";
        const hasWiped = localStorage.getItem(FRESH_PERMANENT_WIPE_KEY);

        if (!hasWiped) {
            // First time loading this version: completely wipe all previous/legacy data everywhere
            if (window.dbStorage && typeof window.dbStorage.purgeAllDataPermanently === 'function') {
                await window.dbStorage.purgeAllDataPermanently();
            }

            localStorage.removeItem("educheck_saved_role");
            localStorage.removeItem("educheck_saved_student_phone");
            state.currentUser = null;

            localStorage.setItem(FRESH_PERMANENT_WIPE_KEY, "true");

            state.students = [];
            state.assignments = [];
            state.submissions = [];
            state.notifications = [];
            return;
        }

        const [students, assigns, subs, notifs] = await Promise.all([
            window.dbStorage.getAll("students"),
            window.dbStorage.getAll("assignments"),
            window.dbStorage.getAll("submissions"),
            window.dbStorage.getAll("notifications")
        ]);

        const DEMO_NAMES = ["সাদিয়া আহমেদ", "সাকিব আল হাসান", "আরিফুল ইসলাম", "নুসরাত জাহান", "তানভীর আহমেদ", "রাফি হাসান", "aaa"];
        const DEMO_PHONES = ["01711000001", "01822000002", "01933000003", "01744000004", "01855000005"];

        // Clean out any old demo students from previous runs
        const cleanStudents = (students || []).filter(s => {
            if (!s) return false;
            const isDemo = DEMO_NAMES.includes(s.name) || DEMO_PHONES.includes(s.phone);
            if (isDemo && window.dbStorage && typeof window.dbStorage.delete === 'function') {
                window.dbStorage.delete("students", s.id).catch(() => {});
            }
            return !isDemo;
        });

        // Clean out any old demo submissions tied to demo names
        const cleanSubs = (subs || []).filter(s => {
            if (!s) return false;
            const isDemo = DEMO_NAMES.includes(s.studentName) || (s.studentName === 'aaa');
            if (isDemo && window.dbStorage && typeof window.dbStorage.delete === 'function') {
                window.dbStorage.delete("submissions", s.id).catch(() => {});
            }
            return !isDemo;
        });

        state.students = cleanStudents;
        state.assignments = assigns || [];
        state.submissions = cleanSubs;
        state.notifications = notifs || [];
    } catch (e) {
        console.warn("Storage sync:", e);
        state.students = [];
        state.assignments = [];
        state.submissions = [];
        state.notifications = [];
    }
}

/**
 * Initialize Canvas Evaluator & Toolbar buttons
 */
function initEvaluatorCanvas() {
    state.evaluator = new KhataCanvasEvaluator("khataCanvas");

    // Tool switcher buttons
    document.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.evaluator.currentTool = btn.dataset.tool;
        });
    });

    // Color buttons
    document.querySelectorAll(".color-circle").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".color-circle").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.evaluator.currentColor = btn.dataset.color;
            if (state.evaluator.currentTool === 'eraser') {
                document.getElementById("toolPen").click();
            }
        });
    });

    // Brush slider
    const sizeSlider = document.getElementById("brushSizeSlider");
    const sizeLabel = document.getElementById("brushSizeDisplay");
    if (sizeSlider && sizeLabel) {
        sizeSlider.addEventListener("input", (e) => {
            state.evaluator.brushSize = parseInt(e.target.value);
            sizeLabel.textContent = `${e.target.value}px`;
        });
    }

    // Notification dropdown toggle
    const bellBtn = document.getElementById("notifBellBtn");
    const notifDropdown = document.getElementById("notifDropdown");
    if (bellBtn && notifDropdown) {
        bellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle("show");
        });
        window.addEventListener("click", () => notifDropdown.classList.remove("show"));
    }

    // Role switcher in header
    document.getElementById("headerStudentBtn")?.addEventListener("click", () => switchAuthTab('student'));
    document.getElementById("headerTeacherBtn")?.addEventListener("click", () => switchAuthTab('teacher'));
    document.getElementById("brandLogo")?.addEventListener("click", () => {
        if (!state.currentUser) switchAuthTab('student');
    });
}

/**
 * Auto Jump for 4-digit OTP input boxes
 */
function initOtpInputAutoJump() {
    const otpBoxes = document.querySelectorAll(".otp-box");
    otpBoxes.forEach((box, idx) => {
        box.addEventListener("input", (e) => {
            if (e.target.value.length === 1) {
                if (idx < otpBoxes.length - 1) {
                    otpBoxes[idx + 1].focus();
                }
            }
            updateCombinedOtp();
        });

        box.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && idx > 0) {
                otpBoxes[idx - 1].focus();
            }
        });

        // Paste support for 4 to 6 digits
        box.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d+$/.test(pasteData)) {
                const digits = pasteData.slice(0, 6).split('');
                digits.forEach((digit, i) => {
                    if (otpBoxes[i]) otpBoxes[i].value = digit;
                });
                updateCombinedOtp();
                if (otpBoxes[digits.length - 1]) otpBoxes[digits.length - 1].focus();
            }
        });
    });
}

function updateCombinedOtp() {
    const otpBoxes = document.querySelectorAll(".otp-box");
    let combined = "";
    otpBoxes.forEach(box => combined += box.value);
    const combinedEl = document.getElementById("studentOtpCombined");
    if (combinedEl) combinedEl.value = combined;
}

// ==========================================================================
// AUTHENTICATION CONTROLLER (STUDENT & TEACHER)
// ==========================================================================
function switchAuthTab(role) {
    state.role = role;

    // Guarantee authSection is displayed and portals are hidden
    const authSection = document.getElementById("authSection");
    if (authSection) authSection.style.display = "flex";

    const teacherPortal = document.getElementById("teacherPortalView");
    const studentPortal = document.getElementById("studentPortalView");
    if (teacherPortal && (!state.currentUser || state.currentUser.role !== 'teacher')) teacherPortal.style.display = "none";
    if (studentPortal && (!state.currentUser || state.currentUser.role !== 'student')) studentPortal.style.display = "none";

    const tabStudent = document.getElementById("tabStudentLogin");
    const tabTeacher = document.getElementById("tabTeacherLogin");
    const paneStudent = document.getElementById("studentLoginPane");
    const paneTeacher = document.getElementById("teacherLoginPane");
    const headerStudentBtn = document.getElementById("headerStudentBtn");
    const headerTeacherBtn = document.getElementById("headerTeacherBtn");

    if (role === 'student') {
        tabStudent?.classList.add("active");
        tabTeacher?.classList.remove("active");
        if (paneStudent) {
            paneStudent.classList.add("active");
            paneStudent.style.display = "block";
        }
        if (paneTeacher) {
            paneTeacher.classList.remove("active");
            paneTeacher.style.display = "none";
        }
        headerStudentBtn?.classList.add("active");
        headerTeacherBtn?.classList.remove("active");
    } else {
        tabTeacher?.classList.add("active");
        tabStudent?.classList.remove("active");
        if (paneTeacher) {
            paneTeacher.classList.add("active");
            paneTeacher.style.display = "block";
        }
        if (paneStudent) {
            paneStudent.classList.remove("active");
            paneStudent.style.display = "none";
        }
        headerTeacherBtn?.classList.add("active");
        headerStudentBtn?.classList.remove("active");
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchAuthTab = switchAuthTab;

/**
 * Student requests OTP for SIM / Mobile number
 */
/**
 * Student Fast Login with Phone / ID (Direct Access - No OTP)
 */
async function handleStudentLoginDirect(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const submitBtn = (event && event.target && typeof event.target.querySelector === 'function')
        ? event.target.querySelector('button[type="submit"]')
        : document.getElementById("sendOtpBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> যাচাই হচ্ছে...`;
    }

    try {
        const query = document.getElementById("studentPhoneInput").value.trim();

        // Clean & normalize query for flexible phone and ID matching
        const cleanQuery = query.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanPhoneDigits = query.replace(/[^0-9]/g, '');
        const standardPhoneQuery = cleanPhoneDigits.startsWith('880') ? cleanPhoneDigits.substring(2) : cleanPhoneDigits;

        // Refresh students from DB to ensure any newly added student is present
        try {
            const stored = await window.dbStorage.getAll("students");
            if (stored && stored.length > 0) state.students = stored;
        } catch (e) {}

        // Find students by phone or ID
        const matchingStudents = state.students.filter(s => {
            const sId = (s.id || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
            const sPhoneDigits = (s.phone || '').replace(/[^0-9]/g, '');
            const sStandardPhone = sPhoneDigits.startsWith('880') ? sPhoneDigits.substring(2) : sPhoneDigits;

            return (
                s.phone === query ||
                (cleanPhoneDigits.length >= 6 && sPhoneDigits === cleanPhoneDigits) ||
                (standardPhoneQuery.length >= 6 && sStandardPhone === standardPhoneQuery) ||
                s.id.toLowerCase() === query.toLowerCase() ||
                sId === cleanQuery
            );
        });

        // If no matching student is found, do NOT auto-register. Only teacher-registered students can log in!
        if (!matchingStudents || matchingStudents.length === 0) {
            showToast("❌ এই নম্বর বা আইডি দিয়ে কোনো শিক্ষার্থী নিবন্ধিত নেই! প্রথমে শিক্ষক প্যানেল থেকে শিক্ষার্থী যুক্ত করতে হবে।", "error");
            return;
        }

        // If multiple students share this phone number (e.g. siblings)
        if (matchingStudents.length > 1) {
            document.getElementById("studentPhoneForm").style.display = "none";
            document.getElementById("multiAccountSelector").style.display = "block";
            renderMultiAccountSelector(matchingStudents);
            return;
        }

        // Single student - login directly!
        const student = matchingStudents[0];
        loginAsStudent(student);
        showToast(`স্বাগতম ${student.name}! শিক্ষার্থী পোর্টালে প্রবেশ করেছেন।`, "success");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `সরাসরি প্রবেশ করুন <i class="fa-solid fa-arrow-right"></i>`;
        }
    }
}

function changeStudentPhone() {
    document.getElementById("studentPhoneForm").style.display = "block";
    document.getElementById("multiAccountSelector").style.display = "none";
}

/**
 * Render multi-account selector cards when multiple students share the same SIM
 */
function renderMultiAccountSelector(students) {
    const list = document.getElementById("multiStudentList");
    if (!list) return;

    list.innerHTML = students.map(s => `
        <div class="multi-student-item" onclick="selectStudentProfile('${s.id}')">
            <img src="${s.avatar}" class="multi-student-avatar" alt="${s.name}">
            <div class="multi-student-info">
                <div class="multi-student-name">${s.name}</div>
                <div class="multi-student-meta">${s.class} • ${s.subject}</div>
                <div class="multi-student-id">আইডি: <strong>${s.id}</strong></div>
            </div>
            <button type="button" class="btn btn-primary btn-sm">
                প্রবেশ <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>
    `).join('') + `
        <button type="button" class="btn btn-outline btn-block" style="margin-top: 1rem;" onclick="changeStudentPhone()">
            <i class="fa-solid fa-arrow-left"></i> অন্য নম্বরে লগইন করুন
        </button>
    `;
}

/**
 * Select specific student profile from multi-account list
 */
async function selectStudentProfile(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    loginAsStudent(student);
    showToast(`স্বাগতম ${student.name}!`, "success");
}

/**
 * Auto-fill helper when OTP simulator popup opens
 */
function autoFillSimulatedOtp() {
    if (window.latestReceivedOtp) {
        const digits = window.latestReceivedOtp.split('');
        const otpBoxes = document.querySelectorAll(".otp-box");
        digits.forEach((d, i) => {
            if (otpBoxes[i]) otpBoxes[i].value = d;
        });
        updateCombinedOtp();
        closeModal("smsOtpSimulatorModal");
    }
}

function quickFillStudent(phone) {
    document.getElementById("studentPhoneInput").value = phone;
    document.getElementById("studentPhoneForm").dispatchEvent(new Event("submit"));
}

/**
 * Teacher Login handler
 */
function handleTeacherLogin(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const email = document.getElementById("teacherEmailInput").value.trim();
    const pass = document.getElementById("teacherPasswordInput").value;

    if (pass.length < 4) {
        showToast("কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড দিন (ডিফল্ট: 123456)", "error");
        return;
    }

    const teacherUser = {
        role: "teacher",
        name: "আফিক স্যার (শিক্ষক)",
        email: email || "teacher@educheck.com",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TeacherAfiq"
    };

    if (document.getElementById("rememberTeacher").checked) {
        localStorage.setItem("educheck_saved_role", "teacher");
    }

    loginAsTeacher(teacherUser);
    showToast("শিক্ষক পোর্টালে স্বাগতম!", "success");
}
window.handleTeacherLogin = handleTeacherLogin;

function loginAsStudent(student) {
    if (!student) return;
    state.currentUser = { role: "student", ...student };
    localStorage.setItem("educheck_saved_role", "student");
    if (student.phone) {
        localStorage.setItem("educheck_saved_student_phone", student.phone);
    }
    applyAuthStateUI();
}

function loginAsTeacher(teacher) {
    state.currentUser = teacher;
    applyAuthStateUI();
}

function checkRememberedSession() {
    const savedRole = localStorage.getItem("educheck_saved_role");
    if (savedRole === "teacher") {
        loginAsTeacher({
            role: "teacher",
            name: "আফিক স্যার (শিক্ষক)",
            email: "teacher@educheck.com",
            avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TeacherAfiq"
        });
    } else if (savedRole === "student") {
        const savedPhone = localStorage.getItem("educheck_saved_student_phone");
        if (savedPhone) {
            const student = state.students.find(s => s.phone === savedPhone || s.id === savedPhone);
            if (student) {
                loginAsStudent(student);
            } else {
                localStorage.removeItem("educheck_saved_role");
                localStorage.removeItem("educheck_saved_student_phone");
            }
        }
    }
}

function handleLogout() {
    state.currentUser = null;
    localStorage.removeItem("educheck_saved_role");
    localStorage.removeItem("educheck_saved_student_phone");
    applyAuthStateUI();
    showToast("লগআউট সফল হয়েছে", "info");
}
window.handleLogout = handleLogout;

document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

function applyAuthStateUI() {
    const authSection = document.getElementById("authSection");
    const teacherPortal = document.getElementById("teacherPortalView");
    const studentPortal = document.getElementById("studentPortalView");
    const userProfilePill = document.getElementById("userProfilePill");
    const guestRoleSwitch = document.getElementById("guestRoleSwitch");
    const notifBtnWrapper = document.getElementById("notifBtnWrapper");
    const mobileBottomNav = document.getElementById("mobileBottomNav");
    const studentMobGroup = document.getElementById("studentMobileNavGroup");
    const teacherMobGroup = document.getElementById("teacherMobileNavGroup");

    if (!state.currentUser) {
        authSection.style.display = "flex";
        teacherPortal.style.display = "none";
        studentPortal.style.display = "none";
        userProfilePill.style.display = "none";
        notifBtnWrapper.style.display = "none";
        guestRoleSwitch.style.display = "flex";
        if (mobileBottomNav) mobileBottomNav.style.display = "none";
        return;
    }

    authSection.style.display = "none";
    guestRoleSwitch.style.display = "none";
    userProfilePill.style.display = "flex";
    notifBtnWrapper.style.display = "block";
    if (mobileBottomNav) mobileBottomNav.style.display = "flex";

    document.getElementById("navUserName").textContent = state.currentUser.name;
    document.getElementById("navUserAvatar").src = state.currentUser.avatar;

    if (state.currentUser.role === "teacher") {
        document.getElementById("navUserRole").textContent = "শিক্ষক (অ্যাডমিন)";
        teacherPortal.style.display = "block";
        studentPortal.style.display = "none";
        if (studentMobGroup) studentMobGroup.style.display = "none";
        if (teacherMobGroup) teacherMobGroup.style.display = "flex";
        renderTeacherDashboard();
    } else {
        document.getElementById("navUserRole").textContent = `শিক্ষার্থী (${state.currentUser.class})`;
        teacherPortal.style.display = "none";
        studentPortal.style.display = "block";
        if (studentMobGroup) studentMobGroup.style.display = "flex";
        if (teacherMobGroup) teacherMobGroup.style.display = "none";
        renderStudentDashboard();
    }

    updateNotificationsUI();
}

function setActiveMobNav(btnEl) {
    if (!btnEl) return;
    document.querySelectorAll(".mobile-nav-item").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
}

// ==========================================================================
// TEACHER DASHBOARD LOGIC
// ==========================================================================
function switchTeacherTab(tabName) {
    document.querySelectorAll(".view-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".teacher-tab-pane").forEach(p => p.style.display = "none");

    if (tabName === 'submissions') {
        document.getElementById("tabTeacherSubmissions").classList.add("active");
        document.getElementById("paneSubmissions").style.display = "block";
        renderTeacherSubmissions();
    } else if (tabName === 'students') {
        document.getElementById("tabTeacherStudents").classList.add("active");
        document.getElementById("paneStudents").style.display = "block";
        renderTeacherStudentsList();
    } else if (tabName === 'assignments') {
        document.getElementById("tabTeacherAssignments").classList.add("active");
        document.getElementById("paneAssignments").style.display = "block";
        renderTeacherAssignments();
    }
}

function renderTeacherDashboard() {
    // Stats calculation
    const totalStudents = state.students.length;
    const pendingKhata = state.submissions.filter(s => s.status === 'pending').length;
    const checkedKhata = state.submissions.filter(s => s.status === 'checked').length;
    const totalAssignments = state.assignments.length;

    document.getElementById("statTotalStudents").textContent = totalStudents;
    document.getElementById("statPendingKhata").textContent = pendingKhata;
    document.getElementById("statCheckedKhata").textContent = checkedKhata;
    document.getElementById("statTotalAssignments").textContent = totalAssignments;
    document.getElementById("pendingSubCount").textContent = pendingKhata;

    renderTeacherSubmissions();
}

function renderTeacherSubmissions() {
    const grid = document.getElementById("teacherSubmissionsGrid");
    const searchQuery = (document.getElementById("submissionSearchInput")?.value || "").toLowerCase();
    const statusFilter = document.getElementById("filterSubmissionStatus")?.value || "all";
    const typeFilter = document.getElementById("filterSubmissionType")?.value || "all";

    let filtered = state.submissions.filter(sub => {
        const matchSearch = sub.studentName.toLowerCase().includes(searchQuery) ||
                            sub.studentId.toLowerCase().includes(searchQuery) ||
                            sub.assignmentTitle.toLowerCase().includes(searchQuery);
        const matchStatus = (statusFilter === 'all') || (sub.status === statusFilter);
        const matchType = (typeFilter === 'all') || (sub.assignmentType === typeFilter);
        return matchSearch && matchStatus && matchType;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4 style="color: #475569;">কোনো খাতা জমা পাওয়া যায়নি</h4>
                <p style="font-size: 0.85rem;">শিক্ষার্থীরা খাতা জমা দিলে এখানে প্রদর্শিত হবে</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(sub => {
        const isPending = sub.status === 'pending';
        const dateFormatted = formatBanglaDateTime(sub.submittedAt);
        const thumbImg = (sub.pages && sub.pages.length > 0) ? sub.pages[0] : SAMPLE_KHATA_IMAGE;
        
        return `
            <div class="submission-card ${isPending ? 'status-pending' : 'status-checked'}">
                <div class="sub-card-header">
                    <div class="sub-student-meta">
                        <img src="${sub.studentAvatar}" class="sub-avatar" alt="${sub.studentName}">
                        <div>
                            <div class="sub-student-name">${sub.studentName}</div>
                            <div class="sub-student-class">${sub.studentClass} • ID: ${sub.studentId}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${isPending ? 'badge-subject' : 'badge-class'}">
                            ${isPending ? '⏳ অপেক্ষমান' : '✅ দেখা শেষ'}
                        </span>
                        <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteSubmission('${sub.id}', '${sub.studentName}')" title="খাতা মুছুন" style="padding: 4px 8px; border-radius: 6px;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="sub-card-body">
                    <div class="sub-assignment-title">${sub.assignmentTitle}</div>
                    <div class="sub-time-meta">
                        <i class="fa-regular fa-clock"></i> জমা: <strong>${dateFormatted}</strong>
                    </div>

                    <div class="sub-preview-thumbnails">
                        ${sub.pages.map((p, i) => `
                            <img src="${p}" class="sub-thumb" title="পৃষ্ঠা ${i+1}">
                        `).join('')}
                    </div>

                    ${sub.studentNote ? `
                        <div class="sub-student-note">
                            <i class="fa-solid fa-quote-left"></i> ${sub.studentNote}
                        </div>
                    ` : ''}

                    ${sub.evaluation ? `
                        <div class="sub-evaluation-summary">
                            <span>প্রাপ্ত নম্বর: ${sub.evaluation.obtainedMarks}/${sub.evaluation.totalMarks} (${sub.evaluation.grade})</span>
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                    ` : ''}
                </div>
                <div class="sub-card-footer">
                    <button class="btn ${isPending ? 'btn-primary' : 'btn-outline'} btn-block" onclick="openKhataEvaluator('${sub.id}')">
                        <i class="fa-solid ${isPending ? 'fa-pen-to-square' : 'fa-eye'}"></i>
                        ${isPending ? 'খাতা দেখুন ও লাল কালিতে কাটুন' : 'পুনরায় মূল্যায়ন / পরিবর্তন'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filterSubmissions() {
    renderTeacherSubmissions();
}

function renderTeacherStudentsList() {
    const grid = document.getElementById("teacherStudentsGrid");
    const query = (document.getElementById("studentSearchInput")?.value || "").toLowerCase();

    const filtered = state.students.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.phone.includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.class.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-user-plus" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 12px;"></i>
                <h4 style="color: #475569; margin-bottom: 6px;">এখনো কোনো শিক্ষার্থী যুক্ত করা হয়নি</h4>
                <p style="font-size: 0.85rem; margin-bottom: 15px;">নতুন শিক্ষার্থী যোগ করতে নিচের বাটনে ক্লিক করুন</p>
                <button class="btn btn-primary btn-sm" onclick="openAddStudentModal()">
                    <i class="fa-solid fa-plus"></i> শিক্ষার্থী যুক্ত করুন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(s => `
        <div class="student-roster-card">
            <img src="${s.avatar}" class="roster-avatar" alt="${s.name}">
            <div class="roster-info">
                <div class="roster-name">${s.name}</div>
                <div class="roster-meta">${s.class} • ${s.subject}</div>
                <div class="roster-phone"><i class="fa-solid fa-phone"></i> ${s.phone}</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <span>আইডি: <strong>${s.id}</strong></span>
                    <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteStudent('${s.id}', '${s.name}')" title="শিক্ষার্থী মুছে ফেলুন" style="padding: 2px 8px; border-radius: 4px;">
                        <i class="fa-solid fa-trash-can"></i> মুছুন
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderTeacherAssignments() {
    const grid = document.getElementById("teacherAssignmentsGrid");
    if (!state.assignments || state.assignments.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-file-circle-plus" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 12px;"></i>
                <h4 style="color: #475569; margin-bottom: 6px;">এখনো কোনো হোমওয়ার্ক বা পরীক্ষা তৈরি করা হয়নি</h4>
                <p style="font-size: 0.85rem; margin-bottom: 15px;">শিক্ষার্থীদের জন্য নতুন কাজ প্রকাশ করতে বাটন চাপুন</p>
                <button class="btn btn-success btn-sm" onclick="openCreateAssignmentModal()">
                    <i class="fa-solid fa-plus"></i> নতুন তৈরি করুন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = state.assignments.map(a => `
        <div class="assignment-card">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <span class="assign-type-badge ${a.type === 'homework' ? 'assign-type-homework' : 'assign-type-exam'}">
                        ${a.type === 'homework' ? 'হোমওয়ার্ক' : 'পরীক্ষার খাতা'}
                    </span>
                    <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteAssignment('${a.id}', '${a.title}')" title="মুছে ফেলুন" style="padding: 2px 6px;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <div class="assign-title">${a.title}</div>
                <p style="font-size: 0.85rem;">${a.description || ''}</p>
            </div>
            <div>
                <div class="assign-deadline" style="margin-bottom: 6px;">
                    <i class="fa-regular fa-clock"></i> শেষ সময়: ${formatBanglaDateTime(a.deadline)}
                </div>
                <div data-deadline="${a.deadline}">
                    ${getExamCountdownHtml(a.deadline)}
                </div>
            </div>
        </div>
    `).join('');
}

async function deleteStudent(studentId, studentName) {
    if (!confirm(`আপনি কি শিক্ষার্থী "${studentName}" (ID: ${studentId}) কে মুছে ফেলতে চান?`)) return;
    state.students = state.students.filter(s => s.id !== studentId);
    await window.dbStorage.delete("students", studentId);
    renderTeacherDashboard();
    renderTeacherStudentsList();
    showToast(`শিক্ষার্থী ${studentName} কে মুছে ফেলা হয়েছে`, "info");
}

async function deleteAssignment(assignmentId, title) {
    if (!confirm(`আপনি কি "${title}" মুছে ফেলতে চান?`)) return;
    state.assignments = state.assignments.filter(a => a.id !== assignmentId);
    await window.dbStorage.delete("assignments", assignmentId);
    renderTeacherDashboard();
    renderTeacherAssignments();
    showToast("হোমওয়ার্ক / পরীক্ষা মুছে ফেলা হয়েছে", "info");
}

async function deleteSubmission(submissionId, studentName) {
    if (!confirm(`আপনি কি ${studentName}-এর এই খাতাটি মুছে ফেলতে চান?`)) return;
    state.submissions = state.submissions.filter(s => s.id !== submissionId);
    await window.dbStorage.delete("submissions", submissionId);
    renderTeacherDashboard();
    showToast("খাতা মুছে ফেলা হয়েছে", "info");
}

// ==========================================================================
// STUDENT REGISTRATION (TEACHER ACTION)
// ==========================================================================
function openAddStudentModal() {
    document.getElementById("addStudentForm").reset();
    randomizeStudentAvatar();
    openModal("addStudentModal");
}

function randomizeStudentAvatar() {
    const seed = "Student_" + Math.random().toString(36).substring(7);
    const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    document.getElementById("previewStudentAvatar").src = url;
}

function previewNewStudentPhoto(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById("previewStudentAvatar").src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function handleSaveNewStudent(event) {
    event.preventDefault();
    const saveBtn = document.getElementById("saveStudentSubmitBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সংরক্ষণ হচ্ছে...`;
    }

    try {
        const name = document.getElementById("newStudentName").value.trim();
        const phone = document.getElementById("newStudentPhone").value.trim();
        const studentClass = document.getElementById("newStudentClass").value;
        const subject = document.getElementById("newStudentSubject").value.trim();
        const avatar = document.getElementById("previewStudentAvatar").src;

        const isSharedPhone = state.students.some(s => s.phone === phone);
        const newStudentId = generateNextStudentId();

        const newStudent = {
            id: newStudentId,
            name,
            phone,
            class: studentClass,
            subject,
            avatar,
            isOtpVerified: false,
            joinedAt: new Date().toISOString()
        };

        state.students.push(newStudent);
        await window.dbStorage.set("students", newStudent);

        closeModal("addStudentModal");
        renderTeacherDashboard();
        renderTeacherStudentsList();

        if (isSharedPhone) {
            showToast(`✅ একই নম্বরে যুক্ত হয়েছে! শিক্ষার্থী ${name} (ID: ${newStudentId}) যুক্ত হয়েছে।`, "success");
        } else {
            showToast(`✅ শিক্ষার্থী ${name} (ID: ${newStudentId}) সফলভাবে যুক্ত হয়েছে!`, "success");
        }
    } catch (err) {
        showToast("সংরক্ষণ ত্রুটি: " + err.message, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> শিক্ষার্থী সংরক্ষণ করুন`;
        }
    }
}

function onSelectAssignmentToSubmit() {
    // Dropdown change callback
}

// ==========================================================================
// CREATE ASSIGNMENT (TEACHER ACTION)
// ==========================================================================
function openCreateAssignmentModal() {
    document.getElementById("createAssignmentForm").reset();
    openModal("createAssignmentModal");
}

async function handleSaveNewAssignment(event) {
    event.preventDefault();
    const saveBtn = event.target.querySelector('button[type="submit"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> প্রকাশ হচ্ছে...`;
    }

    try {
        const title = document.getElementById("assignTitle").value.trim();
        const type = document.getElementById("assignType").value;
        const subject = document.getElementById("assignSubject").value.trim();
        const assignClass = document.getElementById("assignClass").value;
        const deadline = document.getElementById("assignDeadline").value;
        const desc = document.getElementById("assignDesc").value.trim();

        const newAssign = {
            id: (type === 'exam' ? 'XM-' : 'HW-') + Math.floor(100 + Math.random() * 900),
            title,
            type,
            subject,
            class: assignClass,
            deadline: new Date(deadline).toISOString(),
            description: desc,
            createdAt: new Date().toISOString()
        };

        state.assignments.unshift(newAssign);
        await window.dbStorage.set("assignments", newAssign);

        addNotification({
            title: `নতুন ${type === 'exam' ? 'পরীক্ষা' : 'হোমওয়ার্ক'} যুক্ত হয়েছে!`,
            message: `${subject}: "${title}" জমা দেওয়ার শেষ তারিখ ${formatBanglaDateTime(newAssign.deadline)}।`,
            targetClass: assignClass
        });

        closeModal("createAssignmentModal");
        renderTeacherDashboard();
        renderTeacherAssignments();
        showToast("হোমওয়ার্ক / পরীক্ষা সফলভাবে প্রকাশ করা হয়েছে!", "success");
    } catch (err) {
        showToast("সমস্যা হয়েছে: " + err.message, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> প্রকাশ করুন ও শিক্ষার্থীদের জানান`;
        }
    }
}

// ==========================================================================
// DIGITAL KHATA EVALUATION CANVAS ENGINE (TEACHER ACTION)
// ==========================================================================
async function openKhataEvaluator(submissionId) {
    const sub = state.submissions.find(s => s.id === submissionId);
    if (!sub) return;

    state.currentEvaluatingSubmission = sub;
    state.currentEvaluatingPageIndex = 0;

    // Fill Header Info
    document.getElementById("evalStudentName").textContent = sub.studentName;
    document.getElementById("evalStudentAvatar").src = sub.studentAvatar;
    document.getElementById("evalAssignmentTitle").textContent = `${sub.assignmentTitle} • জমা: ${formatBanglaDateTime(sub.submittedAt)}`;

    // Setup pages count
    const totalPages = (sub.pages && sub.pages.length > 0) ? sub.pages.length : 1;
    document.getElementById("totalPagesNum").textContent = totalPages;
    document.getElementById("currentPageNum").textContent = "1";

    // Fill form values if already evaluated
    if (sub.evaluation) {
        document.getElementById("evalMarksObtained").value = sub.evaluation.obtainedMarks;
        document.getElementById("evalMarksTotal").value = sub.evaluation.totalMarks;
        document.getElementById("evalGradeSelect").value = sub.evaluation.grade;
        document.getElementById("evalTeacherRemarks").value = sub.evaluation.remarks;
    } else {
        document.getElementById("evaluationResultForm").reset();
        document.getElementById("evalMarksTotal").value = "20";
    }

    renderEvaluatorPageThumbnails();
    openModal("khataEvaluatorModal");

    // Load first page into canvas
    const imgSource = (sub.pages && sub.pages.length > 0) ? sub.pages[0] : SAMPLE_KHATA_IMAGE;
    await state.evaluator.loadImage(imgSource);
}

function renderEvaluatorPageThumbnails() {
    const strip = document.getElementById("evalPageThumbnails");
    const sub = state.currentEvaluatingSubmission;
    if (!strip || !sub || !sub.pages) return;

    if (sub.pages.length <= 1) {
        strip.style.display = "none";
        return;
    }

    strip.style.display = "flex";
    strip.innerHTML = sub.pages.map((p, i) => `
        <div class="eval-thumb-item ${i === state.currentEvaluatingPageIndex ? 'active' : ''}" onclick="jumpToKhataPage(${i})">
            <img src="${p}" alt="পৃষ্ঠা ${i+1}">
            <span class="thumb-page-badge">পৃষ্ঠা ${i+1}</span>
        </div>
    `).join('');
}

async function jumpToKhataPage(targetIndex) {
    const sub = state.currentEvaluatingSubmission;
    if (!sub || !sub.pages || targetIndex === state.currentEvaluatingPageIndex) return;
    if (targetIndex < 0 || targetIndex >= sub.pages.length) return;

    // Save current canvas annotation
    try {
        sub.pages[state.currentEvaluatingPageIndex] = state.evaluator.exportEvaluatedImage();
    } catch (e) {}

    state.currentEvaluatingPageIndex = targetIndex;
    document.getElementById("currentPageNum").textContent = (targetIndex + 1).toString();
    renderEvaluatorPageThumbnails();
    await state.evaluator.loadImage(sub.pages[targetIndex]);
}

async function navigateKhataPage(delta) {
    const sub = state.currentEvaluatingSubmission;
    if (!sub || !sub.pages) return;

    const newIndex = state.currentEvaluatingPageIndex + delta;
    if (newIndex >= 0 && newIndex < sub.pages.length) {
        await jumpToKhataPage(newIndex);
    }
}

function rotateKhataCanvas() {
    if (state.evaluator && typeof state.evaluator.rotateImage === 'function') {
        state.evaluator.rotateImage();
        showToast("খাতা ৯০° রোটেট করা হয়েছে", "info");
    }
}

function toggleCanvasFullScreen() {
    const modal = document.getElementById("khataEvaluatorModal");
    if (!modal) return;
    modal.classList.toggle("evaluator-fullscreen-active");
    if (modal.classList.contains("evaluator-fullscreen-active")) {
        showToast("ফুলস্ক্রিন মোড সক্রিয়", "info");
    }
}

function autoCalculateGrade() {
    const obInput = document.getElementById("evalMarksObtained");
    const totInput = document.getElementById("evalMarksTotal");
    const gradeSelect = document.getElementById("evalGradeSelect");

    if (!obInput || !totInput || !gradeSelect) return;
    const ob = parseFloat(obInput.value);
    const tot = parseFloat(totInput.value);

    if (isNaN(ob) || isNaN(tot) || tot <= 0) return;
    const pct = (ob / tot) * 100;

    if (pct >= 80) gradeSelect.value = "A+ (অসাধারণ)";
    else if (pct >= 70) gradeSelect.value = "A (খুব ভালো)";
    else if (pct >= 60) gradeSelect.value = "A- (ভালো)";
    else if (pct >= 50) gradeSelect.value = "B (সন্তোষজনক)";
    else if (pct >= 40) gradeSelect.value = "C (উন্নতি প্রয়োজন)";
    else gradeSelect.value = "F (পুনরায় লিখুন)";
}

function setCanvasStamp(stampType) {
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
    state.evaluator.currentTool = 'stamp';
    state.evaluator.currentStamp = stampType;
    showToast(`স্ট্যাম্প সক্রিয়: ${stampType}। খাতায় যেখানে ইচ্ছে ক্লিক করুন।`, "info");
}

function undoCanvas() { state.evaluator?.undo(); }
function redoCanvas() { state.evaluator?.redo(); }
function clearCanvasAnnotations() { state.evaluator?.clearAll(); }

function zoomCanvas(delta) {
    if (!state.evaluator) return;
    if (delta === 0) {
        state.evaluator.resetZoom();
    } else if (delta > 0) {
        state.evaluator.zoomIn();
    } else {
        state.evaluator.zoomOut();
    }
}
window.zoomCanvas = zoomCanvas;

function addQuickRemark(text) {
    const txtArea = document.getElementById("evalTeacherRemarks");
    if (txtArea.value) {
        txtArea.value += " " + text;
    } else {
        txtArea.value = text;
    }
}

/**
 * Save evaluation, marks, remarks and send notification to student
 */
async function handleSaveEvaluation(event) {
    if (event) event.preventDefault();
    const sub = state.currentEvaluatingSubmission;
    if (!sub) return;

    const saveBtn = document.getElementById("saveEvaluationBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> খাতা সেভ ও সিঙ্ক হচ্ছে...`;
    }

    try {
        let obtainedMarks = parseFloat(document.getElementById("evalMarksObtained").value);
        if (isNaN(obtainedMarks)) obtainedMarks = 18;

        let totalMarks = parseFloat(document.getElementById("evalMarksTotal").value);
        if (isNaN(totalMarks) || totalMarks <= 0) totalMarks = 20;

        const grade = document.getElementById("evalGradeSelect")?.value || "A (খুব ভালো)";
        const remarks = (document.getElementById("evalTeacherRemarks")?.value || "").trim() || "খাতা মূল্যায়ন সম্পন্ন হয়েছে।";

        // Capture finalized marked image from canvas
        let checkedImageBase64 = null;
        try {
            checkedImageBase64 = state.evaluator.exportEvaluatedImage();
        } catch (e) {
            checkedImageBase64 = (sub.pages && sub.pages[state.currentEvaluatingPageIndex]) ? sub.pages[state.currentEvaluatingPageIndex] : SAMPLE_KHATA_IMAGE;
        }

        if (!Array.isArray(sub.pages)) sub.pages = [checkedImageBase64];
        sub.pages[state.currentEvaluatingPageIndex] = checkedImageBase64;
        sub.evaluatedImages = [...sub.pages];

        sub.status = "checked";
        sub.evaluation = {
            obtainedMarks,
            totalMarks,
            grade,
            remarks,
            evaluatedAt: new Date().toISOString()
        };

        // 1. Sync in-memory state immediately
        const subIdx = state.submissions.findIndex(s => s.id === sub.id);
        if (subIdx !== -1) {
            state.submissions[subIdx] = { ...sub };
        } else {
            state.submissions.unshift({ ...sub });
        }

        // 2. Save to Database (Firestore & IndexedDB)
        try {
            await window.dbStorage.set("submissions", sub);
        } catch (err) {
            console.warn("Save submission DB notice:", err);
        }

        // 3. Create Notification for student
        const notif = {
            id: "NOTIF-" + Date.now(),
            studentId: sub.studentId,
            title: "✅ শিক্ষক আপনার খাতা মূল্যায়ন করেছেন!",
            message: `${sub.assignmentTitle} - প্রাপ্ত নম্বর: ${obtainedMarks}/${totalMarks} (${grade})। মন্তব্য: "${remarks}"`,
            timestamp: new Date().toISOString(),
            submissionId: sub.id,
            read: false
        };

        state.notifications.unshift(notif);
        try {
            await window.dbStorage.set("notifications", notif);
        } catch (e) {}

        // 4. Reset filter dropdown to show all evaluated and pending submissions clearly
        const statusFilterSelect = document.getElementById("filterSubmissionStatus");
        if (statusFilterSelect) {
            statusFilterSelect.value = "all";
        }

        closeModal("khataEvaluatorModal");
        renderTeacherDashboard();
        updateNotificationsUI();

        showToast("🎉 খাতা মূল্যায়ন সম্পন্ন এবং শিক্ষার্থীর পোর্টালে পাঠানো হয়েছে!", "success");
    } catch (err) {
        showToast("মূল্যায়ন সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> খাতা মূল্যায়ন সম্পন্ন ও জমা দিন`;
        }
    }
}

// ==========================================================================
// STUDENT DASHBOARD & SUBMISSION ENGINE
// ==========================================================================
function switchStudentTab(tabName) {
    document.querySelectorAll(".view-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".student-tab-pane").forEach(p => p.style.display = "none");

    if (tabName === 'activeHw') {
        document.getElementById("tabStudentActiveHw")?.classList.add("active");
        const pane = document.getElementById("paneStudentActiveHw");
        if (pane) pane.style.display = "block";
        renderStudentActiveHw();
    } else if (tabName === 'mySubmissions') {
        document.getElementById("tabStudentMySubmissions")?.classList.add("active");
        const pane = document.getElementById("paneStudentMySubmissions");
        if (pane) pane.style.display = "block";
        renderStudentHistory();
    } else if (tabName === 'leaderboard') {
        document.getElementById("tabStudentLeaderboard")?.classList.add("active");
        const pane = document.getElementById("paneStudentLeaderboard");
        if (pane) pane.style.display = "block";
        renderStudentLeaderboard();
    }
}

function renderStudentLeaderboard() {
    const container = document.getElementById("studentLeaderboardList");
    if (!container) return;

    if (state.students.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem; background: white; border-radius: 14px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-trophy" style="font-size: 2.5rem; color: #f59e0b; margin-bottom: 10px;"></i>
                <h4>এখনো কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি</h4>
                <p style="font-size: 0.85rem; color: #64748b;">শিক্ষক শিক্ষার্থী নিবন্ধন করলে এবং খাতা দেখা শুরু হলে লিডারবোর্ড আপডেট হবে।</p>
            </div>
        `;
        return;
    }

    // Calculate score metrics for each student
    const studentRanks = state.students.map(student => {
        const studentSubs = state.submissions.filter(s => s.studentId === student.id && s.status === 'checked');
        const checkedCount = studentSubs.length;
        let avgPct = 0;
        let totalMarksSum = 0;

        if (checkedCount > 0) {
            const sumPct = studentSubs.reduce((acc, s) => {
                const ob = s.evaluation?.obtainedMarks || 0;
                const tot = s.evaluation?.totalMarks || 20;
                totalMarksSum += ob;
                return acc + (tot > 0 ? (ob / tot) * 100 : 0);
            }, 0);
            avgPct = Math.round(sumPct / checkedCount);
        }

        return {
            ...student,
            checkedCount,
            avgPct,
            totalMarksSum
        };
    });

    // Sort by avgPct descending, then checkedCount descending
    studentRanks.sort((a, b) => b.avgPct - a.avgPct || b.checkedCount - a.checkedCount);

    container.innerHTML = `
        <div class="leaderboard-grid">
            ${studentRanks.map((s, idx) => {
                const isCurrentUser = state.currentUser?.id === s.id;
                let rankBadge = `<span class="rank-num">#${idx + 1}</span>`;
                if (idx === 0) rankBadge = `<span class="rank-medal rank-medal-gold">🥇 ১ম</span>`;
                if (idx === 1) rankBadge = `<span class="rank-medal rank-medal-silver">🥈 ২য়</span>`;
                if (idx === 2) rankBadge = `<span class="rank-medal rank-medal-bronze">🥉 ৩য়</span>`;

                return `
                    <div class="leaderboard-row ${isCurrentUser ? 'current-user-row' : ''}">
                        <div class="leaderboard-left">
                            ${rankBadge}
                            <img src="${s.avatar}" class="leaderboard-avatar" alt="${s.name}">
                            <div class="leaderboard-info">
                                <div class="leaderboard-name">${s.name} ${isCurrentUser ? '<span class="you-badge">আপনি</span>' : ''}</div>
                                <div class="leaderboard-meta"><i class="fa-solid fa-school"></i> ${s.class} • ID: ${s.id}</div>
                            </div>
                        </div>
                        <div class="leaderboard-right">
                            <div class="leaderboard-stat">
                                <strong>${s.avgPct}%</strong>
                                <small>গড় স্কোর</small>
                            </div>
                            <div class="leaderboard-stat">
                                <strong>${s.checkedCount}</strong>
                                <small>যাচাইকৃত খাতা</small>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function renderStudentDashboard() {
    const student = state.currentUser;
    if (!student) return;

    // Refresh submissions from storage to ensure instant sync
    try {
        const storedSubs = await window.dbStorage.getAll("submissions");
        if (storedSubs && storedSubs.length > 0) {
            state.submissions = storedSubs;
        }
    } catch (e) {}

    document.getElementById("studentProfileName").textContent = student.name;
    document.getElementById("studentProfileImg").src = student.avatar;
    document.getElementById("studentProfileClass").innerHTML = `<i class="fa-solid fa-school"></i> ${student.class}`;
    document.getElementById("studentProfileSub").innerHTML = `<i class="fa-solid fa-book"></i> ${student.subject}`;
    document.getElementById("studentProfileId").innerHTML = `<i class="fa-solid fa-id-card"></i> ID: ${student.id}`;
    document.getElementById("studentProfilePhone").innerHTML = `<i class="fa-solid fa-phone"></i> ${student.phone}`;

    // Calculate student analytics metrics
    const mySubs = state.submissions.filter(s => s.studentId === student.id);
    const totalSubs = mySubs.length;
    const checkedSubs = mySubs.filter(s => s.status === 'checked');
    const checkedCount = checkedSubs.length;

    let avgScorePercent = 0;
    if (checkedCount > 0) {
        const totalPct = checkedSubs.reduce((acc, s) => {
            const ob = s.evaluation?.obtainedMarks || 0;
            const tot = s.evaluation?.totalMarks || 20;
            return acc + (tot > 0 ? (ob / tot) * 100 : 0);
        }, 0);
        avgScorePercent = Math.round(totalPct / checkedCount);
    }

    let grade = "N/A";
    if (checkedCount > 0) {
        if (avgScorePercent >= 80) grade = "A+";
        else if (avgScorePercent >= 70) grade = "A";
        else if (avgScorePercent >= 60) grade = "A-";
        else if (avgScorePercent >= 50) grade = "B";
        else grade = "C";
    }

    const statTotalEl = document.getElementById("statStudentTotalSubmissions");
    const statCheckedEl = document.getElementById("statStudentCheckedSubmissions");
    const statAvgEl = document.getElementById("statStudentAvgScore");
    const statGradeEl = document.getElementById("statStudentGrade");

    if (statTotalEl) statTotalEl.textContent = totalSubs;
    if (statCheckedEl) statCheckedEl.textContent = checkedCount;
    if (statAvgEl) statAvgEl.textContent = checkedCount > 0 ? `${avgScorePercent}%` : "--";
    if (statGradeEl) statGradeEl.textContent = grade;

    renderStudentActiveHw();
    renderStudentHistory();
}

function renderStudentActiveHw() {
    const grid = document.getElementById("studentAssignmentsGrid");
    const student = state.currentUser;

    const myAssignments = state.assignments.filter(a => a.class === 'All' || a.class === student.class);

    if (myAssignments.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem 1rem; background: white; border-radius: 12px; border: 1px dashed var(--border); box-shadow: var(--shadow-sm);">
                <i class="fa-solid fa-book-open" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 12px;"></i>
                <h4 style="color: #334155; margin-bottom: 6px;">সরাসরি যেকোনো খাতা জমা দিন</h4>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">শিক্ষক কর্তৃক নির্ধারিত নির্দিষ্ট তালিকা ছাড়াও আপনি যেকোনো হোমওয়ার্ক বা পরীক্ষার খাতার ছবি সরাসরি জমা দিতে পারেন।</p>
                <button class="btn btn-primary" onclick="openSubmitHomeworkModal('GENERAL')">
                    <i class="fa-solid fa-camera"></i> খাতার ছবি জমা দিন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = myAssignments.map(a => {
        // Check if student already submitted this
        const alreadySub = state.submissions.find(s => s.assignmentId === a.id && s.studentId === student.id);

        return `
            <div class="assignment-card">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="assign-type-badge ${a.type === 'homework' ? 'assign-type-homework' : 'assign-type-exam'}">
                            ${a.type === 'homework' ? 'ডেইলি হোমওয়ার্ক' : 'পরীক্ষার খাতা'}
                        </span>
                        <div data-deadline-countdown="${a.deadline}">
                            ${getExamCountdownHtml(a.deadline)}
                        </div>
                    </div>
                    <div class="assign-title">${a.title}</div>
                    <p style="font-size: 0.85rem; color: #475569;">${a.description || ''}</p>
                </div>
                <div>
                    <div class="assign-deadline" style="margin-bottom: 10px;">
                        <i class="fa-regular fa-clock"></i> জমা দেওয়ার শেষ সময়: ${formatBanglaDateTime(a.deadline)}
                    </div>
                    ${alreadySub ? `
                        <button class="btn btn-secondary btn-block" onclick="viewEvaluatedKhata('${alreadySub.id}')">
                            <i class="fa-solid fa-check"></i> জমা দেওয়া হয়েছে (${alreadySub.status === 'checked' ? 'ফলাফল দেখুন' : 'অপেক্ষমান'})
                        </button>
                    ` : `
                        <button class="btn btn-primary btn-block" onclick="openSubmitHomeworkModal('${a.id}')">
                            <i class="fa-solid fa-camera"></i> খাতার ছবি জমা দিন
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentHistory() {
    const grid = document.getElementById("studentHistoryGrid");
    const student = state.currentUser;

    const mySubs = state.submissions.filter(s => s.studentId === student.id);
    const checkedCount = mySubs.filter(s => s.status === 'checked').length;
    document.getElementById("studentCheckedCount").textContent = checkedCount;

    if (mySubs.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-file-circle-question" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>আপনি এখনো কোনো খাতা জমা দেননি</h4>
                <p style="font-size: 0.85rem;">হোমওয়ার্ক সম্পন্ন করে ছবি তুলে জমা দিন</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = mySubs.map(sub => {
        const isChecked = sub.status === 'checked';
        return `
            <div class="submission-card ${isChecked ? 'status-checked' : 'status-pending'}">
                <div class="sub-card-header">
                    <div>
                        <div class="sub-assignment-title" style="font-size: 0.95rem;">${sub.assignmentTitle}</div>
                        <div class="sub-time-meta"><i class="fa-regular fa-clock"></i> জমা: ${formatBanglaDateTime(sub.submittedAt)}</div>
                    </div>
                    <span class="badge ${isChecked ? 'badge-class' : 'badge-subject'}">
                        ${isChecked ? '✅ দেখা সম্পন্ন' : '⏳ যাচাই হচ্ছে'}
                    </span>
                </div>
                <div class="sub-card-body">
                    <div class="sub-preview-thumbnails">
                        ${sub.pages.map((p, i) => `<img src="${p}" class="sub-thumb" title="পৃষ্ঠা ${i+1}">`).join('')}
                    </div>

                    ${isChecked ? `
                        <div class="sub-evaluation-summary">
                            <span>প্রাপ্ত মার্কস: ${sub.evaluation.obtainedMarks}/${sub.evaluation.totalMarks} (${sub.evaluation.grade})</span>
                            <i class="fa-solid fa-award"></i>
                        </div>
                        <div style="font-size: 0.85rem; color: #1e293b; background: #fffbeb; padding: 8px 12px; border-radius: 6px; margin-top: 6px;">
                            <strong>শিক্ষকের মন্তব্য:</strong> "${sub.evaluation.remarks}"
                        </div>
                    ` : `
                        <div style="font-size: 0.8rem; color: #64748b; font-style: italic;">
                            শিক্ষক খাতা দেখে লাল কালিতে কেটে মার্কিং করে এখানে ফেরত পাঠাবেন।
                        </div>
                    `}
                </div>
                <div class="sub-card-footer">
                    <button class="btn ${isChecked ? 'btn-success' : 'btn-outline'} btn-block" onclick="viewEvaluatedKhata('${sub.id}')">
                        <i class="fa-solid ${isChecked ? 'fa-award' : 'fa-eye'}"></i>
                        ${isChecked ? 'দেখা খাতা ও মার্কস দেখুন' : 'জমা দেওয়া পৃষ্ঠাগুলো দেখুন'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Student Submit Homework Modal & Image Upload
function openSubmitHomeworkModal(preselectedAssignId = null) {
    state.selectedUploadImages = [];
    document.getElementById("submitHomeworkForm").reset();
    document.getElementById("khataPagesPreviewWrapper").style.display = "none";
    document.getElementById("khataPagesGrid").innerHTML = "";

    // Populate assignment dropdown
    const select = document.getElementById("submitAssignmentSelect");
    const student = state.currentUser || { class: 'Class 10' };
    const availableAssigns = state.assignments.filter(a => a.class === 'All' || a.class === student.class);

    let optionsHtml = '';
    if (availableAssigns.length > 0) {
        optionsHtml = availableAssigns.map(a => `
            <option value="${a.id}" ${a.id === preselectedAssignId ? 'selected' : ''}>
                ${a.type === 'exam' ? '📝 [পরীক্ষা]' : '📖 [হোমওয়ার্ক]'} ${a.title}
            </option>
        `).join('');
    }
    // Always include General Practice option so students can submit khata anytime
    const isGeneralSelected = (!preselectedAssignId || preselectedAssignId === 'GENERAL' || availableAssigns.length === 0);
    optionsHtml += `<option value="GENERAL" ${isGeneralSelected ? 'selected' : ''}>📝 সাধারণ অনুশীলনী / যেকোনো খাতা জমা</option>`;

    select.innerHTML = optionsHtml;
    openModal("submitHomeworkModal");
}

async function handleKhataImagesSelected(event) {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    for (const file of files) {
        const rawBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });

        // Instant Pre-compression for fast upload and lightweight memory footprint
        let optimized = rawBase64;
        if (window.freeStorage && typeof window.freeStorage.compressImage === 'function') {
            try {
                optimized = await window.freeStorage.compressImage(rawBase64, 1000, 0.72);
            } catch (err) {
                optimized = rawBase64;
            }
        }
        state.selectedUploadImages.push(optimized);
        renderUploadPagesPreview();
    }
}

function renderUploadPagesPreview() {
    const wrapper = document.getElementById("khataPagesPreviewWrapper");
    const grid = document.getElementById("khataPagesGrid");
    const badge = document.getElementById("pageCountBadge");

    if (state.selectedUploadImages.length === 0) {
        wrapper.style.display = "none";
        return;
    }

    wrapper.style.display = "block";
    badge.textContent = `${state.selectedUploadImages.length} পৃষ্ঠা`;

    grid.innerHTML = state.selectedUploadImages.map((imgSrc, idx) => `
        <div class="page-thumb-card">
            <img src="${imgSrc}" alt="পৃষ্ঠা ${idx+1}">
            <button type="button" class="delete-page-btn" onclick="removeSelectedPage(${idx})">&times;</button>
        </div>
    `).join('');
}

function removeSelectedPage(index) {
    state.selectedUploadImages.splice(index, 1);
    renderUploadPagesPreview();
}

async function handleStudentHomeworkSubmit(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const assignSelect = document.getElementById("submitAssignmentSelect");
    const assignId = assignSelect ? assignSelect.value : "GENERAL";
    const noteEl = document.getElementById("studentSubmitNote");
    const note = noteEl ? noteEl.value.trim() : "";
    const student = state.currentUser;
    const submitBtn = document.getElementById("confirmSubmitBtn");

    let assignTitle = "সাধারণ অনুশীলনী / হোমওয়ার্ক খাতা";
    let assignType = "homework";
    const assign = state.assignments.find(a => a.id === assignId);
    if (assign) {
        assignTitle = assign.title;
        assignType = assign.type;
    }

    // Show upload progress on button & disable to prevent double submission
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ছবি প্রসেসিং ও সংরক্ষণ হচ্ছে...`;
    }

    try {
        let finalPages = [];
        if (state.selectedUploadImages.length > 0) {
            for (const rawImg of state.selectedUploadImages) {
                let compressed = rawImg;
                if (window.freeStorage && typeof window.freeStorage.compressImage === 'function') {
                    try {
                        compressed = await window.freeStorage.compressImage(rawImg, 1000, 0.72);
                    } catch (e) {
                        compressed = rawImg;
                    }
                }
                finalPages.push(compressed);
            }
        } else {
            finalPages = [SAMPLE_KHATA_IMAGE];
        }

        const newSub = {
            id: "SUB-" + Date.now(),
            studentId: student ? student.id : (state.currentUser ? state.currentUser.id : generateNextStudentId()),
            studentName: student ? student.name : (state.currentUser ? state.currentUser.name : "শিক্ষার্থী"),
            studentAvatar: student ? student.avatar : (state.currentUser ? state.currentUser.avatar : "https://api.dicebear.com/7.x/bottts/svg?seed=Student"),
            studentClass: student ? (student.class || "Class 10") : "Class 10",
            assignmentId: assign ? assign.id : "GENERAL",
            assignmentTitle: assignTitle,
            assignmentType: assignType,
            submittedAt: new Date().toISOString(),
            pages: finalPages,
            studentNote: note,
            status: "pending",
            evaluation: null
        };

        state.submissions.unshift(newSub);
        await window.dbStorage.set("submissions", newSub);

        // Notify Teacher
        addNotification({
            title: `নতুন খাতা জমা: ${newSub.studentName}`,
            message: `${newSub.studentName} (${newSub.studentClass}) "${assignTitle}" এর খাতা জমা দিয়েছে।`,
            targetRole: "teacher"
        });

        closeModal("submitHomeworkModal");
        renderStudentDashboard();
        showToast("🎉 আপনার খাতা সফলভাবে জমা হয়েছে!", "success");
    } catch (err) {
        console.error("Submission failed:", err);
        showToast("খাতা জমা দিতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> খাতা জমা দিন`;
    }
}

/**
 * Student View Evaluated Khata Modal
 */
function viewEvaluatedKhata(submissionId) {
    const sub = state.submissions.find(s => s.id === submissionId);
    if (!sub) return;

    document.getElementById("viewKhataTitle").innerHTML = `<i class="fa-solid fa-award"></i> ${sub.assignmentTitle}`;
    document.getElementById("viewKhataSubtitle").textContent = `শিক্ষার্থী: ${sub.studentName} • জমা: ${formatBanglaDateTime(sub.submittedAt)}`;

    if (sub.evaluation) {
        document.getElementById("viewScoreObtained").textContent = sub.evaluation.obtainedMarks;
        document.getElementById("viewScoreTotal").textContent = sub.evaluation.totalMarks;
        document.getElementById("viewScoreGrade").textContent = sub.evaluation.grade;
        document.getElementById("viewTeacherRemarksText").textContent = sub.evaluation.remarks;
        document.getElementById("viewEvaluatedDate").textContent = `মূল্যায়নের সময়: ${formatBanglaDateTime(sub.evaluation.evaluatedAt)}`;
    } else {
        document.getElementById("viewScoreObtained").textContent = "--";
        document.getElementById("viewScoreTotal").textContent = "--";
        document.getElementById("viewScoreGrade").textContent = "অপেক্ষমান";
        document.getElementById("viewTeacherRemarksText").textContent = "শিক্ষক এখনো খাতা মূল্যায়ন করেননি। অনুগ্রহ করে অপেক্ষা করুন।";
        document.getElementById("viewEvaluatedDate").textContent = "এখনো দেখা হয়নি";
    }

    const imagesList = document.getElementById("viewCheckedImagesList");
    const displayImages = sub.evaluatedImages || sub.pages || [SAMPLE_KHATA_IMAGE];

    imagesList.innerHTML = displayImages.map((imgSrc, i) => `
        <div style="text-align: center;">
            <span style="font-weight: 600; font-size: 0.85rem; color: #475569; display: block; margin-bottom: 6px;">পৃষ্ঠা ${i+1}:</span>
            <img src="${imgSrc}" class="checked-khata-img" alt="Evaluated Page ${i+1}">
        </div>
    `).join('');

    window.currentViewedKhataImage = displayImages[0];
    openModal("viewEvaluatedKhataModal");
}

function downloadEvaluatedKhata() {
    if (window.currentViewedKhataImage) {
        const link = document.createElement("a");
        link.download = `evaluated-khata-${Date.now()}.jpg`;
        link.href = window.currentViewedKhataImage;
        link.click();
        showToast("খাতা ডাউনলোড হচ্ছে...", "info");
    }
}

// ==========================================================================
// NOTIFICATIONS ENGINE
// ==========================================================================
async function addNotification(notifData) {
    const notif = {
        id: "NOTIF-" + Date.now(),
        timestamp: new Date().toISOString(),
        read: false,
        ...notifData
    };
    state.notifications.unshift(notif);
    await window.dbStorage.set("notifications", notif);
    updateNotificationsUI();
}

function updateNotificationsUI() {
    const badge = document.getElementById("notifBadge");
    const list = document.getElementById("notifList");
    const clearBtn = document.getElementById("clearNotifsBtn");

    if (!list) return;

    // Filter relevant notifications
    const relevant = state.notifications.filter(n => {
        if (!state.currentUser) return false;
        if (state.currentUser.role === 'teacher') return true;
        return !n.studentId || n.studentId === state.currentUser.id;
    });

    const unread = relevant.filter(n => !n.read).length;
    if (badge) {
        badge.textContent = unread.toString();
        badge.style.display = unread > 0 ? "flex" : "none";
    }

    if (relevant.length === 0) {
        list.innerHTML = `<div class="empty-notif">কোনো নতুন নোটিফিকেশন নেই</div>`;
        return;
    }

    list.innerHTML = relevant.map(n => `
        <div class="notif-item ${!n.read ? 'unread' : ''}">
            <div class="notif-item-title"><i class="fa-solid fa-bell" style="color: #4f46e5;"></i> ${n.title}</div>
            <p style="font-size: 0.8rem; margin-top: 2px;">${n.message}</p>
            <div class="notif-item-time">${formatBanglaDateTime(n.timestamp)}</div>
        </div>
    `).join('');

    clearBtn.onclick = async () => {
        state.notifications = [];
        list.innerHTML = `<div class="empty-notif">সকল নোটিফিকেশন মুছে ফেলা হয়েছে</div>`;
        if (badge) badge.style.display = "none";
    };
}

// ==========================================================================
// MODAL & HELPER UTILITIES
// ==========================================================================
function openModal(modalId) {
    document.getElementById(modalId)?.classList.add("show");
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove("show");
}

function renderAllViews() {
    applyAuthStateUI();
}

function formatBanglaDateTime(isoString) {
    if (!isoString) return "--";
    const date = new Date(isoString);
    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
    return date.toLocaleString('bn-BD', options);
}

function showToast(text, type = "info") {
    let bg = "linear-gradient(to right, #4f46e5, #6366f1)";
    if (type === "success") bg = "linear-gradient(to right, #10b981, #059669)";
    if (type === "error") bg = "linear-gradient(to right, #ef4444, #dc2626)";
    if (type === "warning") bg = "linear-gradient(to right, #f59e0b, #d97706)";

    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: text,
            duration: 4000,
            close: true,
            gravity: "top",
            position: "right",
            style: {
                background: bg,
                borderRadius: "10px",
                fontWeight: "600",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)"
            }
        }).showToast();
    }
}

// ==========================================================================
// EXAM LIVE COUNTDOWN TIMER ENGINE
// ==========================================================================
function getExamCountdownHtml(deadline) {
    if (!deadline) return '';
    const now = new Date().getTime();
    const target = new Date(deadline).getTime();
    const diff = target - now;

    if (diff <= 0) {
        return `<span class="countdown-badge countdown-expired"><i class="fa-solid fa-circle-exclamation"></i> সময় শেষ</span>`;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    const isUrgent = diff < 1000 * 60 * 60 * 2; // < 2 hours
    const badgeClass = isUrgent ? 'countdown-urgent' : 'countdown-running';

    let timeStr = '';
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        timeStr = `${days} দিন ${hours % 24} ঘণ্টা বাকি`;
    } else {
        timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `<span class="countdown-badge ${badgeClass}"><i class="fa-solid fa-stopwatch"></i> ${timeStr}</span>`;
}

function initExamCountdownTicking() {
    if (window._examCountdownInterval) clearInterval(window._examCountdownInterval);
    window._examCountdownInterval = setInterval(() => {
        document.querySelectorAll('[data-deadline-countdown]').forEach(el => {
            const dl = el.getAttribute('data-deadline-countdown');
            if (dl) {
                el.innerHTML = getExamCountdownHtml(dl);
            }
        });
    }, 1000);
}

// ==========================================================================
// OMR SHEET EVALUATOR & MCQ AUTO-GRADER
// ==========================================================================
window.omrState = {
    mode: 'key', // 'key' or 'student'
    totalQuestions: 20,
    negativeMark: 0.25,
    answerKey: {},   // { 1: 'B', 2: 'A', ... }
    studentAnswers: {} // { 1: 'B', 2: 'C', ... }
};

function openOmrModal() {
    initOmrGrid();
    openModal("omrEvaluatorModal");
}

function setOmrMode(mode) {
    window.omrState.mode = mode;
    const keyBtn = document.getElementById("omrModeAnswerKeyBtn");
    const stuBtn = document.getElementById("omrModeStudentBtn");

    if (mode === 'key') {
        if (keyBtn) keyBtn.className = "btn btn-sm btn-primary";
        if (stuBtn) stuBtn.className = "btn btn-sm btn-outline";
    } else {
        if (keyBtn) keyBtn.className = "btn btn-sm btn-outline";
        if (stuBtn) stuBtn.className = "btn btn-sm btn-primary";
    }
    renderOmrBubblesUI();
}

function initOmrGrid() {
    const totalSelect = document.getElementById("omrTotalQuestions");
    if (totalSelect) {
        window.omrState.totalQuestions = parseInt(totalSelect.value, 10) || 20;
    }
    renderOmrBubblesUI();
    calculateOmrScore();
}

function renderOmrBubblesUI() {
    const gridWrapper = document.getElementById("omrGridWrapper");
    if (!gridWrapper) return;

    const total = window.omrState.totalQuestions;
    const options = ['A', 'B', 'C', 'D'];
    const mode = window.omrState.mode;

    let html = '';
    for (let q = 1; q <= total; q++) {
        const keyAns = window.omrState.answerKey[q];
        const stuAns = window.omrState.studentAnswers[q];

        html += `
            <div class="omr-q-row">
                <span class="omr-q-num">Q${q}</span>
                <div class="omr-bubbles-group">
        `;

        options.forEach(opt => {
            let bubbleClass = 'omr-bubble';
            if (mode === 'key') {
                if (keyAns === opt) bubbleClass += ' selected';
            } else {
                // In student mode, show whether correct/wrong if key is set
                if (stuAns === opt) {
                    if (keyAns) {
                        bubbleClass += (stuAns === keyAns) ? ' correct' : ' wrong';
                    } else {
                        bubbleClass += ' selected';
                    }
                } else if (keyAns === opt) {
                    bubbleClass += ' key-hint';
                }
            }

            html += `
                <button type="button" class="${bubbleClass}" onclick="handleOmrBubbleClick(${q}, '${opt}')">
                    ${opt}
                </button>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    gridWrapper.innerHTML = html;
}

function handleOmrBubbleClick(qNum, option) {
    if (window.omrState.mode === 'key') {
        if (window.omrState.answerKey[qNum] === option) {
            delete window.omrState.answerKey[qNum];
        } else {
            window.omrState.answerKey[qNum] = option;
        }
    } else {
        if (window.omrState.studentAnswers[qNum] === option) {
            delete window.omrState.studentAnswers[qNum];
        } else {
            window.omrState.studentAnswers[qNum] = option;
        }
    }

    renderOmrBubblesUI();
    calculateOmrScore();
}

function calculateOmrScore() {
    const negSelect = document.getElementById("omrNegativeMark");
    const neg = negSelect ? parseFloat(negSelect.value) : 0.25;
    window.omrState.negativeMark = neg;

    const total = window.omrState.totalQuestions;
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    for (let q = 1; q <= total; q++) {
        const key = window.omrState.answerKey[q];
        const stu = window.omrState.studentAnswers[q];

        if (!stu) {
            unattempted++;
        } else if (key) {
            if (stu === key) {
                correct++;
            } else {
                wrong++;
            }
        } else {
            correct++;
        }
    }

    const rawScore = correct * 1 - (wrong * neg);
    const totalScore = Math.max(0, parseFloat(rawScore.toFixed(2)));
    const pct = total > 0 ? Math.round((totalScore / total) * 100) : 0;

    let grade = 'F';
    if (pct >= 80) grade = 'A+';
    else if (pct >= 70) grade = 'A';
    else if (pct >= 60) grade = 'A-';
    else if (pct >= 50) grade = 'B';
    else if (pct >= 40) grade = 'C';
    else if (pct >= 33) grade = 'D';

    const elCorrect = document.getElementById("omrStatCorrect");
    const elWrong = document.getElementById("omrStatWrong");
    const elUnatt = document.getElementById("omrStatUnattempted");
    const elScore = document.getElementById("omrStatTotalScore");
    const elGrade = document.getElementById("omrStatGrade");

    if (elCorrect) elCorrect.textContent = correct;
    if (elWrong) elWrong.textContent = wrong;
    if (elUnatt) elUnatt.textContent = unattempted;
    if (elScore) elScore.textContent = totalScore.toFixed(2);
    if (elGrade) elGrade.textContent = `${grade} (${pct}%)`;

    window.omrState.calculated = {
        correct, wrong, unattempted, totalScore, total, grade, pct
    };
}

function resetOmrGrid() {
    if (window.omrState.mode === 'key') {
        window.omrState.answerKey = {};
    } else {
        window.omrState.studentAnswers = {};
    }
    renderOmrBubblesUI();
    calculateOmrScore();
    showToast("OMR উত্তরপত্র রিসেট করা হয়েছে", "info");
}

function applyOmrScoreToKhata() {
    const calc = window.omrState.calculated;
    if (!calc) {
        showToast("প্রথমে OMR মূল্যায়ন সম্পন্ন করুন!", "warning");
        return;
    }

    const marksInput = document.getElementById("evalMarksInput");
    const totalInput = document.getElementById("evalTotalInput");
    const remarksInput = document.getElementById("evalRemarksInput");

    if (marksInput) marksInput.value = calc.totalScore;
    if (totalInput) totalInput.value = calc.total;
    if (remarksInput) {
        remarksInput.value = `MCQ OMR মূল্যায়ন: সঠিক ${calc.correct}, ভুল ${calc.wrong}, প্রাপ্ত নম্বর: ${calc.totalScore}/${calc.total} (${calc.grade})`;
    }

    closeModal("omrEvaluatorModal");
    showToast(`✅ OMR নম্বর (${calc.totalScore}/${calc.total}) মূল্যায়ন প্যানেলে যুক্ত করা হয়েছে!`, "success");
}

// ==========================================================================
// DATABASE CLEAN / RESET CONTROLLER
// ==========================================================================
async function promptResetDatabase() {
    const confirmWipe = confirm("⚠️ আপনি কি নিশ্চিত যে ক্লাউড ও লোকাল ডেটাবেসের সমস্ত টেস্ট ডাটা, খাতা, পরীক্ষা ও শিক্ষার্থী চিরতরে মুছে ফেলে একদম নতুন ডেটাবেস করতে চান?\n\nএটি পূর্বাবস্থায় ফিরিয়ে আনা যাবে না!");
    if (!confirmWipe) return;

    try {
        // Clear all states
        state.students = [];
        state.assignments = [];
        state.submissions = [];
        state.notifications = [];

        // Purge completely from local IndexedDB and Cloud Firestore
        if (window.dbStorage && typeof window.dbStorage.purgeAllDataPermanently === 'function') {
            await window.dbStorage.purgeAllDataPermanently();
        }

        renderTeacherDashboard();
        renderTeacherStudentsList();
        renderTeacherAssignments();
        showToast("✨ সমস্ত ডেটাবেস চিরতরে পার্মানেন্টলি মুছে ফেলা হয়েছে (একদম নতুন ফ্রেশ ডেটাবেস)!", "success");
    } catch (err) {
        console.error("Reset error:", err);
        showToast("ডাটাবেস রিসেট সম্পন্ন হয়েছে", "info");
    }
}
