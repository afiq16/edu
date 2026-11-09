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

// Initial Demo Data
const DEMO_STUDENTS = [
    {
        id: "STU-101",
        name: "সাদিয়া আহমেদ",
        phone: "01711000001",
        class: "Class 10",
        subject: "বিজ্ঞান শাখা (উচ্চতর গণিত)",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sadia101",
        isOtpVerified: true,
        joinedAt: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
        id: "STU-102",
        name: "রাফি হাসান",
        phone: "01822000002",
        class: "Class 9",
        subject: "সাধারণ গণিত ও পদার্থবিজ্ঞান",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Rafi102",
        isOtpVerified: true,
        joinedAt: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
        id: "STU-103",
        name: "তানভীর আহমেদ",
        phone: "01933000003",
        class: "Class 10",
        subject: "বিজ্ঞান শাখা",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Tanvir103",
        isOtpVerified: false,
        joinedAt: new Date(Date.now() - 2 * 86400000).toISOString()
    }
];

const DEMO_ASSIGNMENTS = [
    {
        id: "HW-901",
        title: "ত্রিকোণমিতি অধ্যায় ৯.১ অনুশীলনীর ১ থেকে ৮ নম্বর অংক",
        type: "homework", // 'homework' | 'exam'
        subject: "উচ্চতর গণিত",
        class: "Class 10",
        deadline: new Date(Date.now() + 24 * 3600000).toISOString(),
        description: "সকল অংক খাতার পরিষ্কার করে সমাধান করে ছবি তুলে জমা দিবে। বিশেষ করে ৫ ও ৭ নম্বর অংক স্পষ্ট হওয়া চাই।",
        createdAt: new Date(Date.now() - 24 * 3600000).toISOString()
    },
    {
        id: "XM-902",
        title: "পদার্থবিজ্ঞান অধ্যায় ৪: কাজ, ক্ষমতা ও শক্তি (সাপ্তাহিক মডেল টেস্ট)",
        type: "exam",
        subject: "পদার্থবিজ্ঞান",
        class: "Class 10",
        deadline: new Date(Date.now() + 48 * 3600000).toISOString(),
        description: "২০ নম্বরের সৃজনশীল পরীক্ষার সম্পূর্ণ উত্তরপত্র এক বা একাধিক পৃষ্ঠায় ছবি তুলে এখানে জমা দিন।",
        createdAt: new Date(Date.now() - 12 * 3600000).toISOString()
    }
];

// High quality demo khata samples with mathematical problems
const SAMPLE_KHATA_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000' viewBox='0 0 800 1000'><rect width='800' height='1000' fill='%23fafafa'/><line x1='60' y1='0' x2='60' y2='1000' stroke='%23fca5a5' stroke-width='2'/><line x1='0' y1='80' x2='800' y2='80' stroke='%23bae6fd' stroke-width='2'/><g stroke='%23e2e8f0' stroke-width='1'><line x1='60' y1='140' x2='760' y2='140'/><line x1='60' y1='200' x2='760' y2='200'/><line x1='60' y1='260' x2='760' y2='260'/><line x1='60' y1='320' x2='760' y2='320'/><line x1='60' y1='380' x2='760' y2='380'/><line x1='60' y1='440' x2='760' y2='440'/><line x1='60' y1='500' x2='760' y2='500'/><line x1='60' y1='560' x2='760' y2='560'/><line x1='60' y1='620' x2='760' y2='620'/><line x1='60' y1='680' x2='760' y2='680'/><line x1='60' y1='740' x2='760' y2='740'/><line x1='60' y1='800' x2='760' y2='800'/></g><text x='80' y='50' font-family='sans-serif' font-size='20' font-weight='bold' fill='%23334155'>উচ্চতর গণিত - অধ্যায় ৯.১ অনুশীলনী সমাধান</text><text x='80' y='130' font-family='sans-serif' font-size='18' fill='%230f172a'>১ নং প্রশ্নের সমাধান:</text><text x='100' y='180' font-family='sans-serif' font-size='16' fill='%231e293b'>দেওয়া আছে, sin &theta; = 3/5</text><text x='100' y='240' font-family='sans-serif' font-size='16' fill='%231e293b'>আমরা জানি, cos&sup2; &theta; = 1 - sin&sup2; &theta; = 1 - 9/25 = 16/25</text><text x='100' y='300' font-family='sans-serif' font-size='16' fill='%231e293b'>&there4; cos &theta; = 4/5</text><text x='100' y='360' font-family='sans-serif' font-size='16' fill='%231e293b'>অতএব, tan &theta; = sin &theta; / cos &theta; = (3/5) / (4/5) = 3/4 (Ans.)</text><text x='80' y='430' font-family='sans-serif' font-size='18' fill='%230f172a'>২ নং প্রশ্নের সমাধান:</text><text x='100' y='480' font-family='sans-serif' font-size='16' fill='%231e293b'>L.H.S = (1 - tan&sup2;A) / (1 + tan&sup2;A)</text><text x='100' y='540' font-family='sans-serif' font-size='16' fill='%231e293b'>= (1 - sin&sup2;A/cos&sup2;A) / sec&sup2;A</text><text x='100' y='600' font-family='sans-serif' font-size='16' fill='%231e293b'>= (cos&sup2;A - sin&sup2;A)/cos&sup2;A &times; cos&sup2;A = cos&sup2;A - sin&sup2;A = R.H.S (Proved)</text></svg>";

const DEMO_SUBMISSIONS = [
    {
        id: "SUB-801",
        studentId: "STU-101",
        studentName: "সাদিয়া আহমেদ",
        studentAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Sadia101",
        studentClass: "Class 10",
        assignmentId: "HW-901",
        assignmentTitle: "ত্রিকোণমিতি অধ্যায় ৯.১ অনুশীলনীর কাজ",
        assignmentType: "homework",
        submittedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        pages: [SAMPLE_KHATA_IMAGE],
        studentNote: "স্যার, ত্রিকোণমিতির ২ নম্বর অংকটি প্রমাণ করেছি, একটু দেখে দেবেন।",
        status: "pending", // 'pending' | 'checked'
        evaluation: null
    }
];

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
                        }
                    } else if (change.type === "modified") {
                        if (index !== -1) {
                            state.submissions[index] = data;
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
 * Initialize IndexedDB and sync with default dataset
 */
async function initDatabase() {
    try {
        const storedStudents = await window.dbStorage.getAll("students");
        if (!storedStudents || storedStudents.length === 0) {
            for (const s of DEMO_STUDENTS) await window.dbStorage.set("students", s);
            state.students = [...DEMO_STUDENTS];
        } else {
            state.students = storedStudents;
        }

        const storedAssignments = await window.dbStorage.getAll("assignments");
        if (!storedAssignments || storedAssignments.length === 0) {
            for (const a of DEMO_ASSIGNMENTS) await window.dbStorage.set("assignments", a);
            state.assignments = [...DEMO_ASSIGNMENTS];
        } else {
            state.assignments = storedAssignments;
        }

        const storedSubs = await window.dbStorage.getAll("submissions");
        if (!storedSubs || storedSubs.length === 0) {
            for (const sub of DEMO_SUBMISSIONS) await window.dbStorage.set("submissions", sub);
            state.submissions = [...DEMO_SUBMISSIONS];
        } else {
            state.submissions = storedSubs;
        }

        state.notifications = (await window.dbStorage.getAll("notifications")) || [];
    } catch (e) {
        console.warn("Storage sync:", e);
        state.students = [...DEMO_STUDENTS];
        state.assignments = [...DEMO_ASSIGNMENTS];
        state.submissions = [...DEMO_SUBMISSIONS];
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

        // Paste support
        box.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d+$/.test(pasteData)) {
                const digits = pasteData.slice(0, 4).split('');
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
    document.getElementById("studentOtpCombined").value = combined;
}

// ==========================================================================
// AUTHENTICATION CONTROLLER (STUDENT & TEACHER)
// ==========================================================================
function switchAuthTab(role) {
    state.role = role;
    const tabStudent = document.getElementById("tabStudentLogin");
    const tabTeacher = document.getElementById("tabTeacherLogin");
    const paneStudent = document.getElementById("studentLoginPane");
    const paneTeacher = document.getElementById("teacherLoginPane");
    const headerStudentBtn = document.getElementById("headerStudentBtn");
    const headerTeacherBtn = document.getElementById("headerTeacherBtn");

    if (role === 'student') {
        tabStudent?.classList.add("active");
        tabTeacher?.classList.remove("active");
        paneStudent?.classList.add("active");
        paneTeacher?.classList.remove("active");
        headerStudentBtn?.classList.add("active");
        headerTeacherBtn?.classList.remove("active");
    } else {
        tabTeacher?.classList.add("active");
        tabStudent?.classList.remove("active");
        paneTeacher?.classList.add("active");
        paneStudent?.classList.remove("active");
        headerTeacherBtn?.classList.add("active");
        headerStudentBtn?.classList.remove("active");
    }
}

/**
 * Student requests OTP for SIM / Mobile number
 */
async function handleStudentRequestOtp(event) {
    event.preventDefault();
    const query = document.getElementById("studentPhoneInput").value.trim();

    // Find student by phone or ID
    const student = state.students.find(s => s.phone === query || s.id.toLowerCase() === query.toLowerCase());

    if (!student) {
        showToast("⚠️ এই মোবাইল নম্বর বা আইডি দিয়ে কোনো শিক্ষার্থী পাওয়া যায়নি। শিক্ষককে যোগাযোগ করুন।", "error");
        return;
    }

    // Check if device is already remembered (fast login without OTP)
    const rememberedToken = localStorage.getItem(`educheck_token_${student.phone}`);
    if (rememberedToken && student.isOtpVerified) {
        loginAsStudent(student);
        showToast(`স্বাগতম ${student.name}! আপনি পূর্বে ওটিপি যাচাই করেছেন।`, "success");
        return;
    }

    // Trigger OTP Dispatch
    const sendBtn = document.getElementById("sendOtpBtn");
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ওটিপি পাঠানো হচ্ছে...`;

    const res = await window.smsService.sendOtp(student.phone, student.name);

    sendBtn.disabled = false;
    sendBtn.innerHTML = `<span>ওটিপি (OTP) পাঠান</span> <i class="fa-solid fa-paper-plane"></i>`;

    // Switch to OTP view
    document.getElementById("studentPhoneForm").style.display = "none";
    document.getElementById("studentOtpForm").style.display = "block";
    document.getElementById("otpTargetNumber").textContent = student.phone;
    window.tempAuthStudent = student;

    // Start 45s countdown timer
    startOtpCountdown();
}

function startOtpCountdown() {
    clearInterval(state.otpCountdownTimer);
    let secondsLeft = 45;
    const timerDisplay = document.getElementById("otpTimer");
    const resendBtn = document.getElementById("resendOtpBtn");
    const timerText = document.getElementById("otpTimerText");

    if (timerText) timerText.style.display = "inline";
    if (resendBtn) resendBtn.style.display = "none";

    state.otpCountdownTimer = setInterval(() => {
        secondsLeft--;
        if (timerDisplay) timerDisplay.textContent = `00:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;
        if (secondsLeft <= 0) {
            clearInterval(state.otpCountdownTimer);
            if (timerText) timerText.style.display = "none";
            if (resendBtn) resendBtn.style.display = "inline";
        }
    }, 1000);
}

async function handleResendOtp() {
    if (!window.tempAuthStudent) return;
    await window.smsService.sendOtp(window.tempAuthStudent.phone, window.tempAuthStudent.name);
    startOtpCountdown();
}

function changeStudentPhone() {
    document.getElementById("studentPhoneForm").style.display = "block";
    document.getElementById("studentOtpForm").style.display = "none";
    clearInterval(state.otpCountdownTimer);
}

/**
 * Verify 4-digit OTP and login
 */
async function handleStudentVerifyOtp(event) {
    event.preventDefault();
    const enteredOtp = document.getElementById("studentOtpCombined").value.trim();
    const student = window.tempAuthStudent;

    if (!student) return;

    if (enteredOtp.length < 4) {
        showToast("অনুগ্রহ করে সম্পূর্ণ ৪ ডিজিট ওটিপি দিন", "warning");
        return;
    }

    const verification = window.smsService.verifyOtp(student.phone, enteredOtp);

    if (verification.valid) {
        student.isOtpVerified = true;
        await window.dbStorage.set("students", student);

        // Remember device if checked
        if (document.getElementById("rememberStudentDevice").checked) {
            localStorage.setItem(`educheck_token_${student.phone}`, "trusted_device_auth_ok");
        }

        loginAsStudent(student);
        showToast("✅ ওটিপি সফলভাবে যাচাই হয়েছে!", "success");
    } else {
        showToast(verification.message, "error");
    }
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
    event.preventDefault();
    const email = document.getElementById("teacherEmailInput").value.trim();
    const pass = document.getElementById("teacherPasswordInput").value;

    if (pass !== "123456" && pass.length < 4) {
        showToast("ভুল পাসওয়ার্ড। ডিফল্ট পাসওয়ার্ড: 123456", "error");
        return;
    }

    const teacherUser = {
        role: "teacher",
        name: "জনাব মো: নজরুল ইসলাম (শিক্ষক)",
        email: email,
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TeacherNazarul"
    };

    if (document.getElementById("rememberTeacher").checked) {
        localStorage.setItem("educheck_saved_role", "teacher");
    }

    loginAsTeacher(teacherUser);
    showToast("শিক্ষক পোর্টালে স্বাগতম!", "success");
}

function loginAsStudent(student) {
    state.currentUser = { role: "student", ...student };
    localStorage.setItem("educheck_saved_role", "student");
    localStorage.setItem("educheck_saved_student_phone", student.phone);
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
            name: "জনাব মো: নজরুল ইসলাম (শিক্ষক)",
            email: "teacher@educheck.com",
            avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TeacherNazarul"
        });
    } else if (savedRole === "student") {
        const savedPhone = localStorage.getItem("educheck_saved_student_phone");
        if (savedPhone) {
            const student = state.students.find(s => s.phone === savedPhone);
            if (student) loginAsStudent(student);
        }
    }
}

function handleLogout() {
    state.currentUser = null;
    localStorage.removeItem("educheck_saved_role");
    applyAuthStateUI();
    showToast("লগআউট সফল হয়েছে", "info");
}

document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

function applyAuthStateUI() {
    const authSection = document.getElementById("authSection");
    const teacherPortal = document.getElementById("teacherPortalView");
    const studentPortal = document.getElementById("studentPortalView");
    const userProfilePill = document.getElementById("userProfilePill");
    const guestRoleSwitch = document.getElementById("guestRoleSwitch");
    const notifBtnWrapper = document.getElementById("notifBtnWrapper");

    if (!state.currentUser) {
        authSection.style.display = "flex";
        teacherPortal.style.display = "none";
        studentPortal.style.display = "none";
        userProfilePill.style.display = "none";
        notifBtnWrapper.style.display = "none";
        guestRoleSwitch.style.display = "flex";
        return;
    }

    authSection.style.display = "none";
    guestRoleSwitch.style.display = "none";
    userProfilePill.style.display = "flex";
    notifBtnWrapper.style.display = "block";

    document.getElementById("navUserName").textContent = state.currentUser.name;
    document.getElementById("navUserAvatar").src = state.currentUser.avatar;

    if (state.currentUser.role === "teacher") {
        document.getElementById("navUserRole").textContent = "শিক্ষক (অ্যাডমিন)";
        teacherPortal.style.display = "block";
        studentPortal.style.display = "none";
        renderTeacherDashboard();
    } else {
        document.getElementById("navUserRole").textContent = `শিক্ষার্থী (${state.currentUser.class})`;
        teacherPortal.style.display = "none";
        studentPortal.style.display = "block";
        renderStudentDashboard();
    }

    updateNotificationsUI();
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
                    <span class="badge ${isPending ? 'badge-subject' : 'badge-class'}">
                        ${isPending ? '⏳ অপেক্ষমান' : '✅ দেখা শেষ'}
                    </span>
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
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">কোনো শিক্ষার্থী পাওয়া যায়নি</p>`;
        return;
    }

    grid.innerHTML = filtered.map(s => `
        <div class="student-roster-card">
            <img src="${s.avatar}" class="roster-avatar" alt="${s.name}">
            <div class="roster-info">
                <div class="roster-name">${s.name}</div>
                <div class="roster-meta">${s.class} • ${s.subject}</div>
                <div class="roster-phone"><i class="fa-solid fa-phone"></i> ${s.phone}</div>
                <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">আইডি: <strong>${s.id}</strong> | ওটিপি: <span class="badge ${s.isOtpVerified ? 'badge-class' : 'badge-subject'}">${s.isOtpVerified ? 'ভেরিফাইড' : 'নতুন'}</span></div>
            </div>
        </div>
    `).join('');
}

function renderTeacherAssignments() {
    const grid = document.getElementById("teacherAssignmentsGrid");
    grid.innerHTML = state.assignments.map(a => `
        <div class="assignment-card">
            <div>
                <span class="assign-type-badge ${a.type === 'homework' ? 'assign-type-homework' : 'assign-type-exam'}">
                    ${a.type === 'homework' ? 'হোমওয়ার্ক' : 'পরীক্ষার খাতা'}
                </span>
                <div class="assign-title">${a.title}</div>
                <p style="font-size: 0.85rem;">${a.description || ''}</p>
            </div>
            <div class="assign-deadline">
                <i class="fa-regular fa-clock"></i> শেষ সময়: ${formatBanglaDateTime(a.deadline)}
            </div>
        </div>
    `).join('');
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
    const name = document.getElementById("newStudentName").value.trim();
    const phone = document.getElementById("newStudentPhone").value.trim();
    const studentClass = document.getElementById("newStudentClass").value;
    const subject = document.getElementById("newStudentSubject").value.trim();
    const avatar = document.getElementById("previewStudentAvatar").src;

    // Check duplicate phone
    if (state.students.some(s => s.phone === phone)) {
        showToast("এই ফোন নম্বর দিয়ে ইতিমধ্যে একজন শিক্ষার্থী নিবন্ধিত রয়েছে", "warning");
        return;
    }

    const newStudentId = "STU-" + (100 + state.students.length + 1);

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

    // Save to Database
    state.students.push(newStudent);
    await window.dbStorage.set("students", newStudent);

    // Send Welcome SMS & OTP to student's SIM
    await window.smsService.sendOtp(phone, name);

    closeModal("addStudentModal");
    renderTeacherDashboard();
    renderTeacherStudentsList();

    showToast(`✅ শিক্ষার্থী ${name} (ID: ${newStudentId}) সফলভাবে যুক্ত হয়েছে এবং ওটিপি পাঠানো হয়েছে!`, "success");
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

    // Add In-app notification for all matching students
    addNotification({
        title: `নতুন ${type === 'exam' ? 'পরীক্ষা' : 'হোমওয়ার্ক'} যুক্ত হয়েছে!`,
        message: `${subject}: "${title}" জমা দেওয়ার শেষ তারিখ ${formatBanglaDateTime(newAssign.deadline)}।`,
        targetClass: assignClass
    });

    closeModal("createAssignmentModal");
    renderTeacherDashboard();
    renderTeacherAssignments();
    showToast("হোমওয়ার্ক / পরীক্ষা সফলভাবে প্রকাশ করা হয়েছে!", "success");
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

    openModal("khataEvaluatorModal");

    // Load first page into canvas
    const imgSource = (sub.pages && sub.pages.length > 0) ? sub.pages[0] : SAMPLE_KHATA_IMAGE;
    await state.evaluator.loadImage(imgSource);
}

async function navigateKhataPage(delta) {
    const sub = state.currentEvaluatingSubmission;
    if (!sub || !sub.pages) return;

    const newIndex = state.currentEvaluatingPageIndex + delta;
    if (newIndex >= 0 && newIndex < sub.pages.length) {
        // Save current page evaluated state before switching
        sub.pages[state.currentEvaluatingPageIndex] = state.evaluator.exportEvaluatedImage();

        state.currentEvaluatingPageIndex = newIndex;
        document.getElementById("currentPageNum").textContent = (newIndex + 1).toString();
        await state.evaluator.loadImage(sub.pages[newIndex]);
    }
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
    event.preventDefault();
    const sub = state.currentEvaluatingSubmission;
    if (!sub) return;

    const saveBtn = document.getElementById("saveEvaluationBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> খাতা সেভ ও সিঙ্ক হচ্ছে...`;

    const obtainedMarks = parseFloat(document.getElementById("evalMarksObtained").value);
    const totalMarks = parseFloat(document.getElementById("evalMarksTotal").value);
    const grade = document.getElementById("evalGradeSelect").value;
    const remarks = document.getElementById("evalTeacherRemarks").value.trim();
    const sendSms = document.getElementById("evalSendSmsNotify").checked;

    // Capture finalized marked image from canvas and upload via 100% Free Storage
    const checkedImageBase64 = state.evaluator.exportEvaluatedImage();
    const uploadedCheckedUrl = await window.freeStorage.uploadImage(checkedImageBase64);

    sub.pages[state.currentEvaluatingPageIndex] = uploadedCheckedUrl;
    sub.evaluatedImages = [...sub.pages];

    sub.status = "checked";
    sub.evaluation = {
        obtainedMarks,
        totalMarks,
        grade,
        remarks,
        evaluatedAt: new Date().toISOString()
    };

    // Save to Database (Firestore & IndexedDB)
    await window.dbStorage.set("submissions", sub);

    // Create Notification for student
    const notif = {
        id: "NOTIF-" + Date.now(),
        studentId: sub.studentId,
        title: "✅ শিক্ষক আপনার খাতা চেক করেছেন!",
        message: `${sub.assignmentTitle} - প্রাপ্ত নম্বর: ${obtainedMarks}/${totalMarks} (${grade})। মন্তব্য: "${remarks}"`,
        timestamp: new Date().toISOString(),
        submissionId: sub.id,
        read: false
    };

    state.notifications.unshift(notif);
    await window.dbStorage.set("notifications", notif);

    // If SMS notification enabled, trigger SMS
    if (sendSms) {
        const student = state.students.find(s => s.id === sub.studentId);
        if (student) {
            window.smsService.sendOtp(
                student.phone,
                `আপনার ${sub.assignmentTitle} খাতা দেখা হয়েছে। নম্বর: ${obtainedMarks}/${totalMarks}`
            );
        }
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> খাতা মূল্যায়ন সম্পন্ন ও জমা দিন`;

    closeModal("khataEvaluatorModal");
    renderTeacherDashboard();
    updateNotificationsUI();

    showToast("🎉 খাতা মূল্যায়ন সম্পন্ন এবং শিক্ষার্থীর কাছে পাঠানো হয়েছে!", "success");
}

// ==========================================================================
// STUDENT DASHBOARD & SUBMISSION ENGINE
// ==========================================================================
function switchStudentTab(tabName) {
    document.querySelectorAll(".view-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".student-tab-pane").forEach(p => p.style.display = "none");

    if (tabName === 'activeHw') {
        document.getElementById("tabStudentActiveHw").classList.add("active");
        document.getElementById("paneStudentActiveHw").style.display = "block";
        renderStudentActiveHw();
    } else if (tabName === 'mySubmissions') {
        document.getElementById("tabStudentMySubmissions").classList.add("active");
        document.getElementById("paneStudentMySubmissions").style.display = "block";
        renderStudentHistory();
    }
}

function renderStudentDashboard() {
    const student = state.currentUser;
    if (!student) return;

    document.getElementById("studentProfileName").textContent = student.name;
    document.getElementById("studentProfileImg").src = student.avatar;
    document.getElementById("studentProfileClass").innerHTML = `<i class="fa-solid fa-school"></i> ${student.class}`;
    document.getElementById("studentProfileSub").innerHTML = `<i class="fa-solid fa-book"></i> ${student.subject}`;
    document.getElementById("studentProfileId").innerHTML = `<i class="fa-solid fa-id-card"></i> ID: ${student.id}`;
    document.getElementById("studentProfilePhone").innerHTML = `<i class="fa-solid fa-phone"></i> ${student.phone}`;

    renderStudentActiveHw();
    renderStudentHistory();
}

function renderStudentActiveHw() {
    const grid = document.getElementById("studentAssignmentsGrid");
    const student = state.currentUser;

    const myAssignments = state.assignments.filter(a => a.class === 'All' || a.class === student.class);

    if (myAssignments.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">বর্তমানে কোনো সক্রিয় হোমওয়ার্ক বা পরীক্ষা নেই</p>`;
        return;
    }

    grid.innerHTML = myAssignments.map(a => {
        // Check if student already submitted this
        const alreadySub = state.submissions.find(s => s.assignmentId === a.id && s.studentId === student.id);

        return `
            <div class="assignment-card">
                <div>
                    <span class="assign-type-badge ${a.type === 'homework' ? 'assign-type-homework' : 'assign-type-exam'}">
                        ${a.type === 'homework' ? 'ডেইলি হোমওয়ার্ক' : 'পরীক্ষার খাতা'}
                    </span>
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
    const student = state.currentUser;
    const availableAssigns = state.assignments.filter(a => a.class === 'All' || a.class === student.class);

    select.innerHTML = availableAssigns.map(a => `
        <option value="${a.id}" ${a.id === preselectedAssignId ? 'selected' : ''}>
            ${a.type === 'exam' ? '📝 [পরীক্ষা]' : '📖 [হোমওয়ার্ক]'} ${a.title}
        </option>
    `).join('');

    openModal("submitHomeworkModal");
}

function handleKhataImagesSelected(event) {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.selectedUploadImages.push(e.target.result);
            renderUploadPagesPreview();
        };
        reader.readAsDataURL(file);
    });
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
    event.preventDefault();
    const assignId = document.getElementById("submitAssignmentSelect").value;
    const note = document.getElementById("studentSubmitNote").value.trim();
    const student = state.currentUser;
    const submitBtn = document.getElementById("confirmSubmitBtn");

    const assign = state.assignments.find(a => a.id === assignId);
    if (!assign) return;

    // Show upload progress on button
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ছবি প্রসেসিং ও আপলোড হচ্ছে...`;

    // Process & compress all images with 100% Free Storage Engine
    let finalPages = [];
    if (state.selectedUploadImages.length > 0) {
        for (const rawImg of state.selectedUploadImages) {
            const uploadedUrl = await window.freeStorage.uploadImage(rawImg);
            finalPages.push(uploadedUrl);
        }
    } else {
        finalPages = [SAMPLE_KHATA_IMAGE];
    }

    const newSub = {
        id: "SUB-" + Date.now(),
        studentId: student.id,
        studentName: student.name,
        studentAvatar: student.avatar,
        studentClass: student.class,
        assignmentId: assign.id,
        assignmentTitle: assign.title,
        assignmentType: assign.type,
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
        title: `নতুন খাতা জমা: ${student.name}`,
        message: `${student.name} (${student.class}) "${assign.title}" এর খাতা জমা দিয়েছে।`,
        targetRole: "teacher"
    });

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> খাতা জমা দিন`;

    closeModal("submitHomeworkModal");
    renderStudentDashboard();
    showToast("🎉 আপনার খাতা সফলভাবে ফ্রি ক্লাউডে জমা হয়েছে!", "success");
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
