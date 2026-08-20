# Pre-P2-A Migration History Reconciliation

Date: 2026-08-11
Sprint status: discovery complete, repair implementation not authorized

## Safety scope

- Production project: `bnphuinpvgpmebcsvmsp`
- Approved empty staging project: `yonpfzjczoffhrgibxkz`
- All remote database operations in this sprint were read-only `SELECT` statements.
- Disposable replay used only local `postgres:17-alpine` containers.
- No migration was applied to production or staging.
- No Prisma ledger row was changed.
- P2-A migrations A, B1, B2, and C were not executed or edited.

## Production migration inventory

Production contains 162 ledger rows for 146 unique migration names. Every migration name has at least one finished, non-rolled-back row. There are no currently unfinished rows. Sixteen rows are rolled-back attempts across 15 migration names. A finished row with `applied_steps_count = 0` is a resolved-as-applied record, not an executed SQL step.

The approved repository pre-P2-A chain contains 129 directories through `20260803_000001_privileged_identity_hardening`. Of those, 128 names occur in production. Production does not contain the privileged-identity boundary migration.

### Repository-only names

- `20260803_000001_privileged_identity_hardening`

### Production-only names

- `20260107015905_add_factory_models`
- `20260107183409_add_governed_artifact`
- `20260107184538_governed_artifact_unique`
- `20260108170506_add_governance_fields_v2`
- `20260108192837_add_curriculum_content_payload`
- `20260109044415_grading_os_v1`
- `20260110150000_baseline`
- `20260110152000_baseline2`
- `20260219_150000_add_pilot_metadata_to_school`
- `20260219_170000_add_auditlog_school_id`
- `20260219_170000_add_contact_verification_flags`
- `20260219_180000_add_pilot_checklist`
- `20260220_090000_teacher_onboarding_training`
- `20260223_120000_adaptive_baseline`
- `20260224_130000_monthly_reports`
- `20260224_200000_attempt_log`
- `20260416_100000_curriculum_version`
- `20260418_120000_gap_closing_welcome`

### Current repository checksum mismatches

| Migration | Repository SHA-256 | Production ledger checksum |
| --- | --- | --- |
| 20260213_222830_baseline_from_existing_db | 1cd6acbe8bc38bc0f8a22bb123cd8c3f26699db6dcf77488d7b2c8341b8cafd0 | 80d8106e3ca15448bd2627e4bda3e3a7be9dfaf14b7c9abf99afdf73f27f7b64 |
| 20260326_000000_add_rag_chunks | 2a3381264c75dc20344c72c1b5a8fc263547f8cc2a787bb60c020b036ab8841f | 6e12735c21ddd84152736d59dd4218066f46c5058e22a71738920667d4e3ff2d |
| 20260405_191827_phase1_system_of_record | e844c80d9c9166d8b90e297ab1af9cd2878d0b13c2d0e051a29411cc6c8ffccf | 4405ecf30128bcf7127d36eb4fe9f3cb61fdd0a007b9ae2b0d7ad456d8ffd3ae |
| 20260608_000001_wave4_teacher_lessons | 3f2f4ac0047d0e87915338d61bf24f7eb15dd5d3cfe710ad7a7e1fa70d72eca1 | wave4_manual_20260608 |

The `wave4_manual_20260608` production value is not a SHA-256 checksum. Historical migration mutation is therefore unsafe without an explicit cutover and ledger-reconciliation plan.

### Rolled-back attempts

- `20260220_180000_training_reporting`
- `20260226_000000_add_district_and_intervention_log`
- `20260228_000000_block23_perf_indexes`
- `20260228_integrated_delivery_engine`
- `20260302_engineering_cs_standards`
- `20260416_100000_curriculum_version`
- `20260513_000004_sprint13_message_hardening`
- `20260514_000001_sprint14_features`
- `20260514_000001_sprint16_school_onboarding`
- `20260515_000001_sprint17_moe_submissions_language`
- `20260605_000001_certificate_share`
- `20260605_000001_league_district_week`
- `20260713_000003_safeguarding_and_student_id`
- `20260717_000001_sprint6_4_district_update_draft`
- `20260722_000001_sprint7_4_morning_brief`

### Relative ordering differences

- 20260409_214655_phase3_exam_authority was recorded after 20260410_000000_phase2_subject_reconciliation although its repository sort position is earlier.
- 20260511_000000_canva_oauth_pkce was recorded after 20260511_000001_phase7_implementation_workflow although its repository sort position is earlier.
- 20260528_000001_homework_submission_idempotency was recorded after 20260608_000002_wave4b_fork_lineage although its repository sort position is earlier.
- 20260605_000001_certificate_share was recorded after 20260608_000002_wave4b_fork_lineage although its repository sort position is earlier.
- 20260605_000001_league_district_week was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260608_000001_school_storage_quota_bigint was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260702_000001_waec_syllabus_topics was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260703_000001_waec_practice_item was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260704_000001_lesson_media was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260706_000001_agent_platform_foundation was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260708_000001_agent_goal_step_fields was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260708_000002_agent_control was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260713_000001_guardian_conversation was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260713_000002_guardian_sms_cost_accounting was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.
- 20260713_000003_safeguarding_and_student_id was recorded after 20260716_000001_sprint6_3_report_draft although its repository sort position is earlier.

### Complete sanitized ledger

| Migration | started_at | finished_at | rolled_back_at | steps | checksum |
| --- | --- | --- | --- | ---: | --- |
| 20260107015905_add_factory_models | 2026-01-08 19:25:12.228454+00 | 2026-01-08 19:25:13.274783+00 |  | 1 | 226bd3ccf70b4aa2ac74c1d741675c6835afb5cc2b7174fc5d4a0eceab7cdb36 |
| 20260107183409_add_governed_artifact | 2026-01-08 19:25:13.451013+00 | 2026-01-08 19:25:13.911632+00 |  | 1 | 489e9ac3177da610bcab4391c5dc2ef10dfffa732166b1fbfc3a24bf4ae61fbb |
| 20260107184538_governed_artifact_unique | 2026-01-08 19:25:14.10972+00 | 2026-01-08 19:25:14.541538+00 |  | 1 | ff4ee02b8d6ddd6c0a4bfd6678a871a6b4b399bae694f8b0756d2772987d5f78 |
| 20260108170506_add_governance_fields_v2 | 2026-01-08 19:25:14.724616+00 | 2026-01-08 19:25:15.181763+00 |  | 1 | fbae0365ec750861c6bfd30fd5dbec2e0cdd3978e36765fef20f7512569912e5 |
| 20260108192837_add_curriculum_content_payload | 2026-01-08 19:28:38.410729+00 | 2026-01-08 19:28:38.867509+00 |  | 1 | ad793b8a39d9c0b1ce95d813d6a3bba8f296296d3cb52ac245c3c191bc30313d |
| 20260109044415_grading_os_v1 | 2026-01-09 04:44:16.157561+00 | 2026-01-09 04:44:16.555757+00 |  | 1 | 77f8b72c586b13b6655cf5b0e189f28c1c89c381a4beb65c08c73ad620dd2c3a |
| 20260110150000_baseline | 2026-01-10 19:48:18.477678+00 | 2026-01-10 19:48:18.477678+00 |  | 0 | eb7a3d7fa3cfdd215de4171da4721ff2e4537c40baf8702f9190ee698267df10 |
| 20260110152000_baseline2 | 2026-01-10 20:19:07.562506+00 | 2026-01-10 20:19:07.562506+00 |  | 0 | 4080836f69ff7d94d68e237910278059fc80a1dee044204534a26c655ef072e6 |
| 20260213_222830_baseline_from_existing_db | 2026-02-14 03:30:12.948176+00 | 2026-02-14 03:30:12.948176+00 |  | 0 | 80d8106e3ca15448bd2627e4bda3e3a7be9dfaf14b7c9abf99afdf73f27f7b64 |
| 20260219_150000_add_pilot_metadata_to_school | 2026-02-19 20:03:45.345606+00 | 2026-02-19 20:03:45.689862+00 |  | 1 | 76fd5da1662a02fc4d9a49e91791ac169ff425cc21c4be663f85b6b9099fbb62 |
| 20260219_170000_add_contact_verification_flags | 2026-02-19 20:48:04.85332+00 | 2026-02-19 20:48:05.370797+00 |  | 1 | 4bee0aeb684d4f9bcb4545e691632c16d93277bc613e9efc91a4b2776fc26f41 |
| 20260219_180000_add_pilot_checklist | 2026-02-19 20:48:05.524385+00 | 2026-02-19 20:48:06.181845+00 |  | 1 | 5c0878aea8035f25aa155ae9dcc28dd4754d6facc8913edb2b27ce09de4f1a9e |
| 20260219_170000_add_auditlog_school_id | 2026-02-19 23:39:41.603639+00 | 2026-02-19 23:39:42.017308+00 |  | 1 | 753bd0691eb9b6cffe7344c47b976e7090aa4d2cfa309da87763c990147f324f |
| 20260220_090000_teacher_onboarding_training | 2026-02-20 02:18:18.750449+00 | 2026-02-20 02:18:19.568041+00 |  | 1 | f00f722d2a27c409dcf05495c4b3830c404085ecfed8d3663a150f857c6b7824 |
| 20260220_180000_training_reporting | 2026-02-25 05:01:22.718642+00 |  | 2026-02-25 05:05:42.507015+00 | 0 | 7d96b7e257f1532e01275a43138fd04d91d32f0c9603d8021306f94e9f40feea |
| 20260220_180000_training_reporting | 2026-02-25 05:05:42.711515+00 | 2026-02-25 05:05:42.711515+00 |  | 0 | 7d96b7e257f1532e01275a43138fd04d91d32f0c9603d8021306f94e9f40feea |
| 20260220_220000_guardian_sms_metrics | 2026-02-25 12:41:05.034332+00 | 2026-02-25 12:41:05.615439+00 |  | 1 | 5f0442a477b37bea45a4281e210b4b198ad8a4e3a5a0bd17052657914eff4542 |
| 20260223_000000_mastery_engine_foundation | 2026-02-25 12:41:05.728801+00 | 2026-02-25 12:41:06.249815+00 |  | 1 | bdbbfe4c67e959133a5195120e629d69c639d6c3fb4fd20ddc79da25239fe570 |
| 20260223_120000_adaptive_baseline | 2026-02-25 12:41:06.45694+00 | 2026-02-25 12:41:06.966825+00 |  | 1 | 1d033be90c001a129efe80227e718a53801c54a35989b595514ae9e842f7634e |
| 20260224_000000_seed_training_modules | 2026-02-25 12:41:07.170771+00 | 2026-02-25 12:41:07.683484+00 |  | 1 | d73aed91d93ac561116901d4e918d991c2aebcc3290015bcdff25bf7cc634bb2 |
| 20260224_130000_monthly_reports | 2026-02-25 12:41:07.888244+00 | 2026-02-25 12:41:08.398664+00 |  | 1 | 748e729babfae25606a01c227affe933f202a050ff993bb125a1b2e56e696ea1 |
| 20260224_200000_attempt_log | 2026-02-25 12:41:08.603879+00 | 2026-02-25 12:41:09.11729+00 |  | 1 | 466ad15465153f426d85266cd5d72f5eab12f206e71bf45f59e6afb6e505e65d |
| 20260224_000003_add_audit_trace_id | 2026-03-01 15:51:31.7912+00 | 2026-03-01 15:51:32.499417+00 |  | 1 | 2c479f1b56f68b05a2ef5a4df76ddeb8ff9d7c02df3362a6d39e259056523161 |
| 20260225_120000_ai_interaction_log | 2026-03-01 15:51:32.705261+00 | 2026-03-01 15:51:33.215385+00 |  | 1 | c6e9164e6e9d2164e7b1207cb4aeead979a8b9abc8b8cfe11a5abe482a58655c |
| 20260225_130000_block12_impact_snapshot | 2026-03-01 15:51:33.420919+00 | 2026-03-01 15:51:33.93246+00 |  | 1 | 9a050ec19affed98710e067b0d1070812fbbdf0e9cfccc740dd23e6d6c17b5d8 |
| 20260226_000000_add_district_and_intervention_log | 2026-03-01 15:51:34.035243+00 |  | 2026-03-01 15:52:31.904433+00 | 0 | 5dc39b290baf6fa0044fa2ae95ea221605b135d2b8c244c842d319dd1a5f2110 |
| 20260226_000000_add_district_and_intervention_log | 2026-03-01 15:53:51.262103+00 | 2026-03-01 15:53:51.799502+00 |  | 1 | cfbd68756d07cc96870595d569f15602ff99efdd5edf56f64a1485acb964e943 |
| 20260226_120000_block15_longitudinal_growth | 2026-03-01 15:53:51.878909+00 | 2026-03-01 15:53:52.107425+00 |  | 1 | 376c333a6fc7694a9bbeafa5b50b5c93dbcf9ea44b575ebc8e3b3bceb258f5a6 |
| 20260227_000001_add_intervention_outcome_fields | 2026-03-01 15:53:52.191973+00 | 2026-03-01 15:53:52.417519+00 |  | 1 | d37246359f7bc223c888d0950a0d407318efc76474a2b3e5b6f7007cd16e0bb2 |
| 20260227_120000_invitetoken_type_student | 2026-03-01 15:53:52.492277+00 | 2026-03-01 15:53:52.754189+00 |  | 1 | 56482ca278f04ec1ead9ce2b57fc15d6196266d093fb6f0ae369a7db1b4a3802 |
| 20260227_180000_rr1_rr3_tokens_session | 2026-03-01 15:53:52.842539+00 | 2026-03-01 15:53:53.096503+00 |  | 1 | 677f8e124691686fdd13bba262a34b8ce4380d3680efe8422b4ade94c5ed928e |
| 20260228_000000_block23_perf_indexes | 2026-03-01 15:53:53.171926+00 |  | 2026-03-01 15:54:45.209153+00 | 0 | 03bc11847cf2e57db9e9017046f4ec1c3459307cdba4b692ad4e96c2e2ecf40b |
| 20260228_000000_block23_perf_indexes | 2026-03-01 15:54:55.477945+00 |  | 2026-03-01 15:55:45.149+00 | 0 | 5f39138ab26b4fbb9350f5a867fbdcef79ad11a27dd1673e5de4eeb3833b4d81 |
| 20260228_000000_block23_perf_indexes | 2026-03-01 15:55:56.591938+00 | 2026-03-01 15:55:57.100443+00 |  | 1 | f0accaab7fa406130c94f5a3db48f7819e947339928324056bf6173e23c7ff84 |
| 20260228_civics_strands | 2026-03-01 15:55:57.408276+00 | 2026-03-01 15:55:57.920186+00 |  | 1 | 13940e4e009eeb6247a854e93d9318ca17e4bc3817158495b6c2740b17b24e1b |
| 20260228_curriculum_feedback | 2026-03-01 15:55:58.022745+00 | 2026-03-01 15:55:58.53469+00 |  | 1 | 1c2bdbcf2f4dd3acbae48318af6ff2bab0dc4b4abc7296b924dac02cc4567d92 |
| 20260228_integrated_delivery_engine | 2026-03-01 15:55:58.743235+00 |  | 2026-03-01 15:56:56.939054+00 | 0 | a90f7743cbbc6982c692ead4ef6eac61b1d9f7346db72b00d60facca98ed7caa |
| 20260228_integrated_delivery_engine | 2026-03-01 15:57:04.763496+00 | 2026-03-01 15:57:05.054258+00 |  | 1 | fb1aa1a900419b1132e2c02bce0c52138d11a1d04f97c0bd96e804db41a04fed |
| 20260228_math_strands | 2026-03-01 15:57:05.134221+00 | 2026-03-01 15:57:05.354265+00 |  | 1 | 2f3dc5de598a5d15faa3e025a5bfdc1164cd24e6c56ded00817f16861c6e4a31 |
| 20260301_000000_block26_perf_indexes | 2026-03-15 04:40:01.545986+00 | 2026-03-15 04:40:01.894014+00 |  | 1 | ef32adfaf0d4fc5aa085b41e5a91d848f978b5019d132f0ffba72cb10f794211 |
| 20260301_000001_moe_official_role | 2026-03-15 04:40:01.988778+00 | 2026-03-15 04:40:02.230981+00 |  | 1 | 7d2ce2d661c7fa2ad71cd123969db68132808624e920213a0b429d1ae54a2c30 |
| 20260302_add_auditlog_composite_index | 2026-03-15 04:40:02.305931+00 | 2026-03-15 04:40:02.545071+00 |  | 1 | ea35637bfa2ab8b3854d2dfb453be91f223dfe85a99633812af75cc257e07080 |
| 20260302_engineering_cs_standards | 2026-03-15 04:40:02.622423+00 |  | 2026-03-15 04:46:29.038925+00 | 0 | ccec2ab681ccb0cd2debb5c75b0f7194ab7a66187411742557758ed8d1747813 |
| 20260302_engineering_cs_standards | 2026-03-15 04:46:29.243396+00 | 2026-03-15 04:46:29.243396+00 |  | 0 | c3254055e5e9755796b8a03ca4dbf435edfa9f1fa2d4aa446cbb0f1dcf06ce18 |
| 20260302_guardian_message | 2026-03-15 04:46:40.205152+00 | 2026-03-15 04:46:40.815071+00 |  | 1 | 883126dfd7b2bc7f8cefffb1e284a6485d336a5d4fc3d58f49c00cd0df9c98f5 |
| 20260313_000000_add_lesson_embeddings | 2026-03-15 04:46:41.019759+00 | 2026-03-15 04:46:41.532642+00 |  | 1 | 26a6f67dcc26c6239dd7799c3df5e98e6028b84968b3201cdd72510cbd7f9479 |
| 20260313_010000_add_teacher_created_flag | 2026-03-15 04:46:41.737143+00 | 2026-03-15 04:46:42.248505+00 |  | 1 | 5a154d845bf26e86af22a106d3ad696481d4bc38eb65297a8b4d9cac374bd2dd |
| 20260313_020000_add_lesson_ordering_fields | 2026-03-15 04:46:42.454883+00 | 2026-03-15 04:46:42.965688+00 |  | 1 | 77db7540e281083474fee12d4483cc480a2dc1c90b81c7bb8b69ae77eb75deac |
| 20260313_030000_add_placement_ai_analysis | 2026-03-15 04:46:43.141343+00 | 2026-03-15 04:46:43.873842+00 |  | 1 | 680de2563239ed4f1758b0e00485641c28a398a6a4c35286287d37488e262a0b |
| 20260313_040000_add_placement_teacher_review | 2026-03-15 04:46:44.091177+00 | 2026-03-15 04:46:44.60388+00 |  | 1 | ed89660ec093ebeadedb5cda8cace3b43c674ec54abc46a96d44d4229db75628 |
| 20260313_050000_add_lab_ai_analysis | 2026-03-15 04:46:44.911878+00 | 2026-03-15 04:46:45.320587+00 |  | 1 | f6d582b7981039d85b116dc620ececf6a1c998f107ecd3eb42bcc9b84f5bc373 |
| 20260313_060000_add_school_code | 2026-03-15 04:46:45.429537+00 | 2026-03-15 04:46:45.917464+00 |  | 1 | 198cbefa4dda78cc83236dd446f0bff2e7d75af5b1634814e2982dc201dbd3c5 |
| 20260313_070000_add_must_change_pin | 2026-03-15 04:46:46.01006+00 | 2026-03-15 04:46:46.379911+00 |  | 1 | 4dc6c3ee35c845d934ce24ddcc15378d800bd87600342a0dde6e2ab6728acfa9 |
| 20260313_080000_add_exit_ticket_progress | 2026-03-15 04:46:46.490743+00 | 2026-03-15 04:46:46.810074+00 |  | 1 | 31f282ee595c18c3ac7990500ccb80422992757ed21a4b77f0cd71ad1da2fbd3 |
| 20260313_090000_expand_assignment_submissions | 2026-03-15 04:46:46.914714+00 | 2026-03-15 04:46:47.169322+00 |  | 1 | fc43f3a2a457886eea2ac9e804d165f12344e8f540e6f735be8c3fb294892ee2 |
| 20260313_100000_add_adaptive_attempts | 2026-03-15 04:46:47.27013+00 | 2026-03-15 04:46:47.550932+00 |  | 1 | a0e79e626e51640a7c5ba0ebf4b2941dda0c42876ba81aff12f7feb4c9ab3605 |
| 20260314_010000_add_exam_system | 2026-03-15 04:46:47.650627+00 | 2026-03-15 04:46:47.989347+00 |  | 1 | 4e7cf3282aff3d245161bc6a33ce300124a44cb8e00e9d26f069128418becc65 |
| 20260315_000000_add_login_id_to_user | 2026-03-15 06:12:38.503958+00 | 2026-03-15 06:12:38.503958+00 |  | 0 | 692f1b455c27f575ca777b040528bc6304fd8b5a16b2c34edee0816b925c1c97 |
| 20260326_000000_add_rag_chunks | 2026-03-26 21:12:37.01916+00 | 2026-03-26 21:12:37.489355+00 |  | 1 | 6e12735c21ddd84152736d59dd4218066f46c5058e22a71738920667d4e3ff2d |
| 20260327_000000_add_eval_runs | 2026-04-02 23:55:25.785041+00 | 2026-04-02 23:55:26.400547+00 |  | 1 | 42539ac67c074e1cede44b4ceab2df9ac068bca93c560506e1bf567d1b521040 |
| 20260327_000000_add_intelligence_layer | 2026-04-02 23:55:26.506457+00 | 2026-04-02 23:55:27.045585+00 |  | 1 | 7157cfa921d30c2a2daf81ef550d06c3d949dec944c8fe1e7508f38757dd5740 |
| 20260330_add_ai_usage_fields | 2026-04-02 23:55:27.149501+00 | 2026-04-02 23:55:27.483707+00 |  | 1 | 560181063ec6119dfcc7ec5d230b323776c38bf9738a69d93aa0446062d16f91 |
| 20260331_000000_production_audit_fixes | 2026-04-02 23:55:27.660365+00 | 2026-04-02 23:55:28.216497+00 |  | 1 | fd5c61472598f54aae2f100cca1482507f440b54147bf02941f41b7db03e8e45 |
| 20260401_120000_guardian_sms_preferences_json | 2026-04-02 23:55:28.377155+00 | 2026-04-02 23:55:28.652302+00 |  | 1 | eb5971b70215ef37f4da7382597e5eecefdbdda91b74368d1899d98baf880ef2 |
| 20260403_190000_add_slo_events | 2026-04-03 19:25:34.805014+00 | 2026-04-03 19:25:34.805014+00 |  | 0 | 5209a3ccad067fb92241100213a4a069c6cf4ebc6620a0abf06e9686490fae87 |
| 20260403_230000_ai_cost_guardrails | 2026-04-05 20:25:56.598542+00 | 2026-04-05 20:25:56.978931+00 |  | 1 | e565586bdc52a706ba04bf7e1333c6ccdfecafbc35b83bf3802a1ef68ea892c7 |
| 20260405_000000_add_curriculum_title | 2026-04-05 20:25:57.062377+00 | 2026-04-05 20:25:57.280285+00 |  | 1 | 0c27ac193caaa844cd634dac83cfc714ff85c5c59a98e300258901609b566187 |
| 20260405_191827_phase1_system_of_record | 2026-04-09 14:09:34.020457+00 | 2026-04-09 14:09:34.020457+00 |  | 0 | 4405ecf30128bcf7127d36eb4fe9f3cb61fdd0a007b9ae2b0d7ad456d8ffd3ae |
| 20260409_124356_phase2_school_operations | 2026-04-09 16:51:50.68806+00 | 2026-04-09 16:51:50.68806+00 |  | 0 | dbe9629fff8e79f13e4bed7357013aee0a1a6f7eed84adc3b2c23003f0098bdd |
| 20260410_000000_phase2_subject_reconciliation | 2026-04-10 13:07:52.995281+00 | 2026-04-10 13:07:52.995281+00 |  | 0 | 8345a8c35d290d2141ae8ad2e743015367815a258bd9dfc2526ce87efe3da75f |
| 20260409_214655_phase3_exam_authority | 2026-04-10 13:40:34.194922+00 | 2026-04-10 13:40:34.194922+00 |  | 0 | dff4df24e83a29132133c336187ff3fa627cefc8583c110a7a44a0670c848d0e |
| 20260413_180000_sprint2_event_layer | 2026-04-16 18:26:41.790432+00 | 2026-04-16 18:26:42.430259+00 |  | 1 | ac99587a84270c50e5ed790b670779618711bad21920152e29a96d0057843739 |
| 20260413_210000_sprint3_intervention_chains | 2026-04-16 18:26:42.580031+00 | 2026-04-16 18:26:42.895925+00 |  | 1 | 44afeb59f1851a67ab4910a991fdcd8d6f777198c80998b204aa3d6359f9ccd9 |
| 20260413_230000_sprint4_ai_telemetry_sync_integrity | 2026-04-16 18:26:42.984213+00 | 2026-04-16 18:26:43.293631+00 |  | 1 | a3ef5dce942cc18e997367e89154caeffbc82488c0c2a4302fb104968ee5a0d6 |
| 20260415_000000_sprint7_governance_analytics | 2026-04-16 18:26:43.407905+00 | 2026-04-16 18:26:43.645663+00 |  | 1 | c80e7cc8fde175270615d2c5e6ab0b33b1a31b61954fa27117cec095068700f4 |
| 20260415_210000_sprint12_student_progress_certificates | 2026-04-16 18:26:43.8127+00 | 2026-04-16 18:26:44.132739+00 |  | 1 | efb819d3e9d4b5fdac68bf9d51fb23f350188a07f212fb555b413d523d1b82a6 |
| 20260415_230000_sprint14_school_operations_layer | 2026-04-16 18:26:44.233152+00 | 2026-04-16 18:26:44.457182+00 |  | 1 | c14caac59f1859e1a47c511aaef6dca7059807a627ac7627f9d5aa7c22dcb79c |
| 20260416_000000_sprint15_sms_types | 2026-04-16 18:26:44.577686+00 | 2026-04-16 18:26:44.885045+00 |  | 1 | 0322643ff09d08065553ac6b9f38af700a1e4beaa7090deb836f800c8ebb9c93 |
| 20260416_100000_curriculum_version | 2026-04-17 01:28:26.34741+00 |  | 2026-04-17 01:28:47.235138+00 | 0 | 4d135521fabed294b855fafcf8179dbd1db2ac135cd90272106545ddb3c43896 |
| 20260416_100000_curriculum_version | 2026-04-17 01:29:06.294561+00 | 2026-04-17 01:29:06.954669+00 |  | 1 | 5dd2a8604c928c709fbcde06ce23fe43786a3777e8280477eef0c1a8f29f6399 |
| 20260417_160000_sprint16f_policy_acceptance_ip | 2026-04-17 17:34:56.189756+00 | 2026-04-17 17:34:56.574014+00 |  | 1 | 3309967f8df6e3b840c05f2015f237af260e08680b5ac58fd5b9f2408a6c9915 |
| 20260418_120000_gap_closing_welcome | 2026-04-19 01:33:16.446218+00 | 2026-04-19 01:33:17.049417+00 |  | 1 | d9123ef54d00f075e604a600212e8ba7022bd2c63ae2eebbbef172710fe7c257 |
| 20260418_000000_multimedia_delivery | 2026-04-22 03:00:32.19734+00 | 2026-04-22 03:00:32.808293+00 |  | 1 | 535756d2df95f66887ba893cadecb66fcb40a946d3c04aff5658f61f5e3995b3 |
| 20260424_000001_phase53_action_models | 2026-04-24 20:15:06.580305+00 | 2026-04-24 20:15:08.549423+00 |  | 1 | 000ce3326c86558ca92ac468cbb9e30e69003cd4dffeb26e422da9fab7d35418 |
| 20260425_000000_teacher_onboarding | 2026-04-26 00:47:19.592958+00 | 2026-04-26 00:47:20.19183+00 |  | 1 | fe6f804c9b151ff813b00f86af2a7c543c1eddecb7c6445a5c56d48defb337de |
| 20260425_000001_teacher_sentiment | 2026-04-26 00:47:20.398454+00 | 2026-04-26 00:47:20.955894+00 |  | 1 | e82a08c19bdd4bb5e0fbd10bf4bf5bf3618457b490b339e0fcdacb27a7c70511 |
| 20260427_000000_academic_year_promotion | 2026-04-28 12:19:33.609525+00 | 2026-04-28 12:19:34.203465+00 |  | 1 | 915dabf914d91344051e6f23bafefd1d72ae8626b513e27e6ad9e1aac162c585 |
| 20260427_000001_timetable | 2026-04-28 12:19:34.419394+00 | 2026-04-28 12:19:35.022659+00 |  | 1 | a3f96a2146fead7e5a5735b428affe55591e8d956d52a2f851ec064f54f25334 |
| 20260428_000000_curriculum_year_mapping | 2026-04-28 16:07:50.91361+00 | 2026-04-28 16:07:52.073256+00 |  | 1 | 286c12b943635133044ed35d16babe1afba4e31e07751ca349ae683fc4924acf |
| 20260429_000000_textbook_generation_queue | 2026-04-29 18:41:14.281417+00 | 2026-04-29 18:41:14.886744+00 |  | 1 | f8f0d2610653fca6c46c20f31f39671fbaf6df83d6548bb3daf7ca8e5977501b |
| 20260429_010000_lesson_audio_parts | 2026-04-29 20:36:15.982594+00 | 2026-04-29 20:36:16.304034+00 |  | 1 | 7d2be46623d57918b39f6b3654c602caaec9ffea9da792d0701940233c11edb0 |
| 20260430_000000_grade_pipeline_orchestration | 2026-04-30 20:49:43.723319+00 | 2026-04-30 20:49:44.80052+00 |  | 1 | 0593d466c5de6ce4434c6e88b80808a8c3082d71cbd45c1caaa754b773bdc8d3 |
| 20260430_010000_add_student_badge_award | 2026-04-30 20:49:45.180204+00 | 2026-04-30 20:49:46.096129+00 |  | 1 | 70199700b7d828fb3719ff0a145f1f28b5e5b634f73913571ca283ab985e3ec5 |
| 20260501_010000_add_moe_policy_governance | 2026-05-01 12:22:26.704824+00 | 2026-05-01 12:22:27.601276+00 |  | 1 | a14d1684ce7f1f8059b83ce8a9463ff7671e86f9ef3ffe8b2a08b43aafb141df |
| 20260507_000000_canva_asset_automation | 2026-05-07 20:20:08.929733+00 | 2026-05-07 20:20:10.417312+00 |  | 1 | dcf8d125647a97f35f32e16d3c526fb45f565b635c00162fa9bb9ad275dddf76 |
| 20260508_000000_curriculum_regeneration_pipeline | 2026-05-08 19:01:56.499643+00 | 2026-05-08 19:01:57.292784+00 |  | 1 | 7468aec1b980a08113225d10ad0816e85e26cbad412131169672a22fde5cb989 |
| 20260510_000000_autonomous_workflow_foundation | 2026-05-11 17:57:13.664482+00 | 2026-05-11 17:57:15.547603+00 |  | 1 | 8205bcd79215417719c5294694d43da97b642523d02e94fed56d85bd8990cbcf |
| 20260511_000001_phase7_implementation_workflow | 2026-05-11 17:57:15.88647+00 | 2026-05-11 17:57:16.675519+00 |  | 1 | 58837f4529b351ab2dceb8b27103db3694f7cb4684dc5dcc1480dbec5ed18707 |
| 20260511_000000_canva_oauth_pkce | 2026-05-11 20:38:21.060162+00 | 2026-05-11 20:38:21.777279+00 |  | 1 | 945d75438afc30ea8923a5ebbf57850e25153e6f12eb0ccdcabe4cf764f64660 |
| 20260511_010000_canva_oauth_state | 2026-05-11 21:25:31.799148+00 | 2026-05-11 21:25:32.486973+00 |  | 1 | 018448d752ec731461c32bdd2a6e158cb937603c8057093060c43e205dd1aaca |
| 20260511_020000_phase8_schema_gaps | 2026-05-11 22:17:14.945503+00 | 2026-05-11 22:17:15.952023+00 |  | 1 | f6f412d623b727d08010d2ea82ee38cee98c7dae75f2732bd7a3a5fee48ae119 |
| 20260512_000000_sprint2_assignment_grading | 2026-05-12 04:00:08.212621+00 | 2026-05-12 04:00:08.702088+00 |  | 1 | 0a3f7705912020409b34581b7bf2903e125a573730e49b707bebd346b046281a |
| 20260512_000001_sprint3_report_cards | 2026-05-14 03:46:38.09658+00 | 2026-05-14 03:46:38.867739+00 |  | 1 | bd1f9b5923b2316f3ac4a16233b53af3a7a645875f78f5ca20d6c3d9da5765d0 |
| 20260512_000002_sprint4_push_subscriptions | 2026-05-14 03:46:38.968826+00 | 2026-05-14 03:46:39.381493+00 |  | 1 | f25cedf9ea8c6a6532dd302ce8aafab6b49bbab08b511d0f816e7494f78927bc |
| 20260512_000003_phase10_operator_incident_note | 2026-05-14 03:46:39.584971+00 | 2026-05-14 03:46:40.008931+00 |  | 1 | 9534591e707a1892dbc3fa6b6acb385811967284b10faa54d977df50f675ac24 |
| 20260512_000005_sprint5_school_events | 2026-05-14 03:46:40.199321+00 | 2026-05-14 03:46:40.710781+00 |  | 1 | 297c8ca6828e1a4339af6f1941b73814a7a41418ae05314e6b42088c2850cc56 |
| 20260512_000006_sprint6_live_sessions | 2026-05-14 03:46:40.915326+00 | 2026-05-14 03:46:41.343571+00 |  | 1 | 9c7680ea33a53d20d3db6812bfee39ab68cbf6052e769717e7e4e0934f4246cd |
| 20260512_000007_sprint7_discussion_boards | 2026-05-14 03:46:41.531242+00 | 2026-05-14 03:46:41.94006+00 |  | 1 | 3f4045cd9d1e29c8f6ef128a461572a7cf842e8653f400c8b3d55566661dac90 |
| 20260513_000001_sprint9_generated_documents | 2026-05-14 03:46:42.145454+00 | 2026-05-14 03:46:42.758948+00 |  | 1 | a792ccfe959023045a7bb789197e48196d8f453b748e592aac85c5ce8ec8365d |
| 20260513_000002_sprint10_portfolio_capstone | 2026-05-14 03:46:42.963591+00 | 2026-05-14 03:46:43.475884+00 |  | 1 | 8dce9c6ad4dcaa385bca9afe6ac1bf5e58abde2860817e21970769655f58a4a0 |
| 20260513_000003_sprint12_unified_messaging | 2026-05-14 03:46:43.68273+00 | 2026-05-14 03:46:44.192724+00 |  | 1 | a49430964ebec796e1d100e33689f7db0871d260fea8e088b88467c63bd7f64f |
| 20260513_000004_sprint13_message_hardening | 2026-05-14 04:16:43.459302+00 |  | 2026-05-14 04:17:11.622501+00 | 0 | b0fc516adefddf0ac9a0dde0d0b5dd1665bacb268416209d9cacd266f93f8333 |
| 20260513_000004_sprint13_message_hardening | 2026-05-14 04:17:32.201449+00 | 2026-05-14 04:17:32.707087+00 |  | 1 | a7acac1543006b27c8a71635a88286883475c0a0d29efde87e657ddce99b2635 |
| 20260514_000001_sprint14_features | 2026-05-17 23:48:39.243965+00 |  | 2026-05-17 23:53:18.035371+00 | 0 | 4eaf53b42e8fa07a33ca0d3964c9d7abf462826fddbf3489da028cc339e730ce |
| 20260514_000001_sprint14_features | 2026-05-17 23:53:31.303244+00 | 2026-05-17 23:53:32.294728+00 |  | 1 | b5f89670187fa60dedd83bb047fbf60c6932d04f3d4eef9df83364a8445c21f7 |
| 20260514_000001_sprint16_school_onboarding | 2026-05-17 23:53:32.500619+00 |  | 2026-05-17 23:54:04.040682+00 | 0 | 49dc60ce038cc4fb04f38fba6eef31fc28d4f7dd2ef38b2b86fb655500bf89c2 |
| 20260514_000001_sprint16_school_onboarding | 2026-05-17 23:54:14.901682+00 | 2026-05-17 23:54:15.404504+00 |  | 1 | f1685593f7d05bf7b5d9c5d863c46f84bd5658d440f35e28e8a3a1bb3cbeb525 |
| 20260514_000002_sprint15_features | 2026-05-17 23:54:15.610813+00 | 2026-05-17 23:54:16.123929+00 |  | 1 | 86a6443a5020025b659266e2a5e8d9b60470c624d6430092ce0e17008f522403 |
| 20260515_000001_sprint17_moe_submissions_language | 2026-05-17 23:54:16.327176+00 |  | 2026-05-17 23:56:47.408103+00 | 0 | a3ed8c80f6a1438f06d6fe3e7534a8b6843f5503879595c611ebc1f793aab8bc |
| 20260515_000001_sprint17_moe_submissions_language | 2026-05-17 23:56:58.122775+00 | 2026-05-17 23:56:58.629853+00 |  | 1 | 9055bfc3c93ce9ded36f73133c0c2dc064f5b68f394ae19a33c948c4afd4e2d0 |
| 20260515_000001_sprint18_password_reset_admin_code | 2026-05-17 23:56:58.833932+00 | 2026-05-17 23:56:59.346326+00 |  | 1 | 8d53d94e686fe09e282a7626d9b429664c44ee6322d8750ebd78b0cb2262f0f5 |
| 20260516_000001_sprint19_tutor_conversation | 2026-05-17 23:56:59.559784+00 | 2026-05-17 23:57:00.165153+00 |  | 1 | d532fd6256d4b86d725bc829ed26f686b2a3e887b6e30ec97c3e92dfce9843e7 |
| 20260516_000001_sprint20_ai_grading | 2026-05-17 23:57:00.369882+00 | 2026-05-17 23:57:00.881647+00 |  | 1 | 2d344bcebbdb454ba1b81381545737f53317eeb0b11e9dad3c1261dc6b559332 |
| 20260516_000002_sprint21_video_microlessons | 2026-05-17 23:57:01.086755+00 | 2026-05-17 23:57:01.598571+00 |  | 1 | f4bea39c8c48369ea8a62bf15e2747b2cc5c2f3e128967e8bf685a1d706ddebb |
| 20260517_000001_sprint22_google_sso | 2026-05-17 23:57:01.804262+00 | 2026-05-17 23:57:02.315318+00 |  | 1 | 62f7603c7121b677a07b9c3a8377f6dcc92b25d263c12e88bade2269a2e64452 |
| 20260517_000002_sprint23_teacher_alert_prefs | 2026-05-17 23:57:02.520558+00 | 2026-05-17 23:57:03.033694+00 |  | 1 | c015694b2a9e01338ed0fd83294fb52dcf2477ec122368cb53eaa7917b1bbc2d |
| 20260517_000003_sprint24_tour_privacy | 2026-05-17 23:57:03.237319+00 | 2026-05-17 23:57:03.749825+00 |  | 1 | b8e1bfd5c1c7dd751532d5c9d61c4c8996c51b46e47d0ab54ebab8c345e400be |
| 20260517_000004_sprint25_lesson_versions_shares | 2026-05-17 23:57:03.955091+00 | 2026-05-17 23:57:04.670365+00 |  | 1 | 12dd7bf1dc9dfeb0a4cf864e985a2e098ed6e809b624f103a28b25d776f4e1ed |
| 20260517_000005_sprint26_sms_league_portfolio | 2026-05-19 16:35:58.692449+00 | 2026-05-19 16:35:59.855474+00 |  | 1 | 59f47a044b4b9abcc9e06baebcabd4842eabc2716957583d9510ad3e75c72d69 |
| 20260522_000001_audit_immutability | 2026-05-22 21:09:21.986075+00 | 2026-05-22 21:09:22.550821+00 |  | 1 | cb8585781a5f16cd30ea798bd8f0735f2966a43540ef71a5c5574474629344a5 |
| 20260529_000001_adaptive_engine | 2026-05-29 15:53:12.886443+00 | 2026-05-29 15:53:12.886443+00 |  | 0 | 2cf95ffe5e8d4965e08afad53ac9509fc8f1dcbea9690140996b41ce23367990 |
| 20260529_000002_graded_submission | 2026-05-29 21:09:41.31987+00 | 2026-05-29 21:09:41.31987+00 |  | 0 | 1767e15650aa82ea1fdef6728850cda144528fc3f102d60d89bb655c305625bd |
| 20260601_000001_code_exercise_ai_literacy | 2026-06-01 20:16:36.548867+00 | 2026-06-01 20:16:36.548867+00 |  | 0 | 0c8380a44b8c8130e8a3c50870c76d7c50ad453020e56b83bfc4028f1d7a9681 |
| 20260603_000001_hero_discriminator | 2026-06-04 03:27:49.846038+00 | 2026-06-04 03:27:49.846038+00 |  | 0 | 970ef9b164469a6f121c571d923900eb2e91afcbb065f06eec858a80c95e1d09 |
| 20260604_000001_add_english_to_subject_enum | 2026-06-04 23:14:40.560469+00 | 2026-06-04 23:14:40.560469+00 |  | 0 | 6037aa52c2718d968ca11c2db5aba3bbfbd1734643a2b42728520835b18cd8ac |
| 20260605_000002_offline_pack | 2026-06-05 22:33:56.53313+00 | 2026-06-05 22:33:56.53313+00 |  | 0 | 31301571e74e60705a2484dc557b6eaeb647dff37cf051499323637a9276825b |
| 20260608_000001_wave4_teacher_lessons | 2026-06-08 22:00:34.054142+00 | 2026-06-08 22:00:34.054142+00 |  | 1 | wave4_manual_20260608 |
| 20260608_000002_wave4b_fork_lineage | 2026-06-09 22:57:15.536983+00 | 2026-06-09 22:57:15.536983+00 |  | 0 | 95faec0f74ef1dc2a5c6ea482547d84ec4fb6419dfafb8a9ac87d2a6fa55ac16 |
| 20260528_000001_homework_submission_idempotency | 2026-07-13 17:43:08.222496+00 | 2026-07-13 17:43:08.906823+00 |  | 1 | 55c614e805546649429f98a120a6d70028745fd3600fe37822839a6cac20066f |
| 20260605_000001_certificate_share | 2026-07-13 17:43:09.218231+00 |  | 2026-07-15 14:33:56.214064+00 | 0 | e3079270341dbedcab8a0dcc6aeb1fe70f2e460fe545aad2066cc7a4b47cd983 |
| 20260605_000001_certificate_share | 2026-07-15 14:33:56.431882+00 | 2026-07-15 14:33:56.431882+00 |  | 0 | e3079270341dbedcab8a0dcc6aeb1fe70f2e460fe545aad2066cc7a4b47cd983 |
| 20260715_000001_sprint6_2_content_qa_review | 2026-07-16 15:24:02.956514+00 | 2026-07-16 15:24:02.956514+00 |  | 0 | f01590fbc80faa0282bb5c22c7ce08bcc58f09768a3b5ed00ae5b90d757735f8 |
| 20260716_000001_sprint6_3_report_draft | 2026-07-16 18:40:30.530408+00 | 2026-07-16 18:40:30.530408+00 |  | 1 | 47ce7b9165cc0892336b8bd824a5590844c8e10e54bb4d5dfb4cc80360afe71f |
| 20260605_000001_league_district_week | 2026-07-28 21:35:52.335003+00 |  | 2026-07-28 21:40:53.459366+00 | 0 | 0fde7328b1cb8192d45efc0ac07ace9ad5e96be44b02683c3b7491e4f88db91a |
| 20260605_000001_league_district_week | 2026-07-28 21:40:53.658433+00 | 2026-07-28 21:40:53.658433+00 |  | 0 | 0fde7328b1cb8192d45efc0ac07ace9ad5e96be44b02683c3b7491e4f88db91a |
| 20260608_000001_school_storage_quota_bigint | 2026-07-28 21:41:44.126657+00 | 2026-07-28 21:41:49.327654+00 |  | 1 | ba91c23fb1af9b6ae062788d0a297080c66bfc9bfaf4ec21c6ae574424e7c4b6 |
| 20260702_000001_waec_syllabus_topics | 2026-07-28 21:41:49.499659+00 | 2026-07-28 21:41:54.97634+00 |  | 1 | 3a278d59606b4721096733c36b30b5dfbb0229184070154f41a36423cff1093a |
| 20260703_000001_waec_practice_item | 2026-07-28 21:41:55.133441+00 | 2026-07-28 21:41:55.561558+00 |  | 1 | 39b0d8b184ef7813ce6c8b94fa023197e1df30f9a5471d5d8524d00a94f430d9 |
| 20260704_000001_lesson_media | 2026-07-28 21:41:55.77058+00 | 2026-07-28 21:41:56.324916+00 |  | 1 | 67ba37067958d89322d0bb32d226499e90782794295055971aa684665fb07a0a |
| 20260706_000001_agent_platform_foundation | 2026-07-28 21:41:56.534271+00 | 2026-07-28 21:41:57.160495+00 |  | 1 | 77b5eb4ef76aef422fcc98f87b3a5a2863c67de6e0809c68a06e2c2e91654cfd |
| 20260708_000001_agent_goal_step_fields | 2026-07-28 21:42:02.174886+00 | 2026-07-28 21:42:02.697519+00 |  | 1 | 0ce5a02b2e4f8d9d6596da870dfa9767ec3fb208c90452d23bf5c704470511f1 |
| 20260708_000002_agent_control | 2026-07-28 21:42:02.871361+00 | 2026-07-28 21:42:03.42749+00 |  | 1 | 8c52cb17cb0c8157ce5dbc78fd77bb04f205cb06db77136b64c561242f4399f1 |
| 20260713_000001_guardian_conversation | 2026-07-28 21:42:03.636609+00 | 2026-07-28 21:42:04.05407+00 |  | 1 | 93ecb44c975666de8e6a433fd8d0cf03797e25353687cfa031de6a300bf69b5d |
| 20260713_000002_guardian_sms_cost_accounting | 2026-07-28 21:42:13.776365+00 | 2026-07-28 21:42:14.33714+00 |  | 1 | 78acb6d8a871d2a5a353b7af5d235b3480b460b0fdc1fb2f7996290c5776108d |
| 20260713_000003_safeguarding_and_student_id | 2026-07-28 21:42:14.499257+00 |  | 2026-07-28 21:43:27.328773+00 | 0 | f0aa77599d095dd8dbac75170f6f8ee80d85aa4a6f9a137b51d08850e0cb2932 |
| 20260713_000003_safeguarding_and_student_id | 2026-07-28 21:43:27.46504+00 | 2026-07-28 21:43:27.46504+00 |  | 0 | f0aa77599d095dd8dbac75170f6f8ee80d85aa4a6f9a137b51d08850e0cb2932 |
| 20260717_000001_sprint6_4_district_update_draft | 2026-07-28 21:43:38.590176+00 |  | 2026-07-28 21:44:33.414901+00 | 0 | 032f30c38c910189c3f7af0ee271814ef6818719ebf851e7b53ccc896177c336 |
| 20260717_000001_sprint6_4_district_update_draft | 2026-07-28 21:44:33.622689+00 | 2026-07-28 21:44:33.622689+00 |  | 0 | 032f30c38c910189c3f7af0ee271814ef6818719ebf851e7b53ccc896177c336 |
| 20260722_000001_sprint7_4_morning_brief | 2026-07-28 21:45:31.174782+00 |  | 2026-07-28 21:47:37.032769+00 | 0 | 0d9222ee56d7470029d1445de693ce95a73fb1ac122fc6fca7b985cec8e7ffaa |
| 20260722_000001_sprint7_4_morning_brief | 2026-07-28 21:47:37.205162+00 | 2026-07-28 21:47:37.205162+00 |  | 0 | 0d9222ee56d7470029d1445de693ce95a73fb1ac122fc6fca7b985cec8e7ffaa |
| 20260728_000001_teaching_runtime_v1 | 2026-07-28 21:47:51.76098+00 | 2026-07-28 21:47:52.34962+00 |  | 1 | f8d1b308637da65e7b8f65d10c944951adc33f0e69d8f71a884cb4af88d235f6 |
| 20260728_000002_teaching_turn_sequence | 2026-07-28 21:47:52.484926+00 | 2026-07-28 21:47:52.821149+00 |  | 1 | b011578555b530275b4b269c554e4e59b8b943d8ab8cd2c12067d7177d6d2374 |

## TrainingModule reconciliation

The current repository migration `20260220_180000_training_reporting` creates `TrainingModule` with `code`, `pilotOnly`, and non-null `updatedAt`, but without `content`, `sortOrder`, `estimatedMinutes`, or `isActive`.

Production first received its training schema from the repository-absent migration `20260220_090000_teacher_onboarding_training`. Its historical Git blob is `738ee17ec824d30eca664d7ba6726324932fae79`. That SQL creates:

- `content text NULL`
- `sortOrder integer NOT NULL DEFAULT 0`
- `estimatedMinutes integer NOT NULL DEFAULT 0`
- `isActive boolean NOT NULL DEFAULT true`
- the `TrainingModule_isActive_sortOrder_idx` index

Production attempted `20260220_180000_training_reporting` later. It failed with PostgreSQL `42710` because `TrainingStatus` already existed, was rolled back, and was then recorded as finished with zero applied steps. Production currently has the legacy TrainingModule shape, plus nullable unique `code`; it does not have `pilotOnly` or `updatedAt`.

The seed `20260224_000000_seed_training_modules` is recorded as successfully executed with one step. Production contains exactly eight TrainingModule rows and all eight deterministic seed IDs/codes. No later current-repository migration creates the three missing seed columns. Production therefore obtained them from the absent earlier migration, not from the current chain.

## Initial baseline encoding and checksum

- File: `prisma/migrations/20260213_222830_baseline_from_existing_db/migration.sql`
- Encoding: UTF-16 LE with BOM `FF FE`
- Byte length: 50,256
- NUL bytes: 25,127
- Current raw SHA-256: `1cd6acbe8bc38bc0f8a22bb123cd8c3f26699db6dcf77488d7b2c8341b8cafd0`
- UTF-8 without BOM byte length: 25,127
- UTF-8 without BOM SHA-256: `8d207af403d70c2b91ca3eff87be85d261405af5d40f29cf1508bdfaac602df9`
- UTF-8 LF-normalized SHA-256: `5d6990c3e10304e75f35d5def42125c22d3f1a759823617803dbb14144304c4e`
- Production ledger checksum: `80d8106e3ca15448bd2627e4bda3e3a7be9dfaf14b7c9abf99afdf73f27f7b64`

The production checksum matches neither the committed UTF-16 bytes nor tested UTF-8/BOM/line-ending variants. Git history contains one blob version for this path, blob `23c145411c04424629f75567e354ab52261d64af`, introduced by the two equivalent baseline commits. No committed UTF-8 form was found. Production recorded this migration as finished with zero applied steps, so this artifact was a baseline marker rather than SQL executed against production. The present file is both clean-bootstrap incompatible and checksum-divergent from the bytes used when production was resolved.

## Clean replay forensic inventory

The reusable harness is `scripts/diagnose-pre-p2a-clean-replay.ps1`. Every bypass is explicit, is applied only to a temporary copy, and is destroyed with the local PostgreSQL 17 container.

Observed failures:

1. `20260213_222830_baseline_from_existing_db`: Prisma `P3018`; client-side embedded NUL encoding failure; no PostgreSQL code.
2. `20260224_000000_seed_training_modules`: Prisma `P3018`, PostgreSQL `42703`; missing `sortOrder` (and also `estimatedMinutes` and `isActive`).
3. Same seed after adding the legacy columns: Prisma `P3018`, PostgreSQL `23502`; the seed omits the replacement migration's non-null `updatedAt` without a default.
4. `20260227_120000_invitetoken_type_student`: Prisma `P3018`, PostgreSQL `42P01`; `InviteToken` is never created in the current chain.
5. `20260228_integrated_delivery_engine`: Prisma `P3018`, PostgreSQL `42P01`; `CurriculumContent` is never created in the current chain.

A static ordered dependency audit identifies six tables referenced but never created by the 129-directory chain:

- `CurriculumContent`
- `InviteToken`
- `PasswordResetToken`
- `PlatformTransferToken`
- `ScheduledWork`
- `StudentProgress`

The chain creates 186 other tables, but these absent foundational tables are used by 23 later DML/DDL reference events. This is systemic history drift. Continuing by inventing final-shape tables would cease to be neutral forensics and would amount to constructing the repair.

## Trusted schema comparison

Comparison source for intended pre-P2-A Prisma shape: commit `246a608fddf4f47e0733cb4b6c598fe44490fe59`.

- Production: 196 application tables plus `_prisma_migrations`.
- Prisma: 198 models.
- Production-only: `TrendSnapshot` and implicit Prisma join table `_SkillToStandard`.
- Prisma-only: `PolicyConfig`, `PolicyOverride`, `PrivilegedIdentity`, `PrivilegedSessionAssurance`.
- Shared table column drift:
  - `User.welcomeCompletedAt` exists only in production.
  - `InterventionRecommendation.updatedAt` exists only in Prisma.
- `PolicyScope` exists only in Prisma.
- Production `Role` lacks Prisma values `MOE_SUPER_ADMIN` and `MOE_DISTRICT_ADMIN`.
- `Subject` and `AcademicEnrollmentStatus` contain the same values but in a different enum order.
- Confirmed default drift includes `CapstoneProject.status`: Prisma `DRAFT`, production `ACTIVE`.
- Confirmed type drift includes timestamp-with-time-zone production columns represented as Prisma `DateTime`, vector fields, and nullable PostgreSQL arrays that Prisma models as required scalar lists.

The current Prisma schema, production catalog, and repository history are therefore three evidence sources. None is authoritative alone. The canonical baseline must be an explicitly reviewed reconciliation, with production structure as the starting point and only separately approved forward deltas added.

## Raw PostgreSQL objects to preserve

Production public-schema inventory:

- 703 indexes: 699 btree, 2 gin, 2 ivfflat.
- Five partial btree indexes, two expression GIN full-text indexes, and two IVFFLAT vector indexes require raw SQL preservation.
- 431 constraints: 196 primary keys, 217 foreign keys, 18 unique constraints.
- 19 enum types with production ordering.
- Two application PL/pgSQL functions: `prevent_audit_delete()`, `prevent_audit_update()`.
- Two enabled AuditLog triggers: `audit_log_no_update` and `audit_log_no_delete`.
- Extensions: `pg_stat_statements` 1.11 in `extensions`, `pgcrypto` 1.3 in `extensions`, `plpgsql` 1.0 in `pg_catalog`, `supabase_vault` 0.3.1 in `vault`, `uuid-ossp` 1.1 in `extensions`, `vector` 0.8.0 in `public`.
- No public views, materialized views, sequences, generated columns, check constraints, or RLS policies were found.
- RLS is disabled on all 197 public tables. This finding is preserved for the separate P0 audit; no RLS change is part of this repair.

Special indexes that cannot be reconstructed from ordinary Prisma model declarations alone:

- `CurriculumContent_isHero_idx` on `CurriculumContent`: `CREATE INDEX "CurriculumContent_isHero_idx" ON public."CurriculumContent" USING btree ("isHero") WHERE ("isHero" = true)`
- `GradedSubmission_clientSubmissionId_key` on `GradedSubmission`: `CREATE UNIQUE INDEX "GradedSubmission_clientSubmissionId_key" ON public."GradedSubmission" USING btree ("clientSubmissionId") WHERE ("clientSubmissionId" IS NOT NULL)`
- `HomeworkSubmission_clientSubmissionId_key` on `HomeworkSubmission`: `CREATE UNIQUE INDEX "HomeworkSubmission_clientSubmissionId_key" ON public."HomeworkSubmission" USING btree ("clientSubmissionId") WHERE ("clientSubmissionId" IS NOT NULL)`
- `InterventionRecommendation_idempotencyKey_key` on `InterventionRecommendation`: `CREATE UNIQUE INDEX "InterventionRecommendation_idempotencyKey_key" ON public."InterventionRecommendation" USING btree ("idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`
- `TeacherAlert_idempotencyKey_key` on `TeacherAlert`: `CREATE UNIQUE INDEX "TeacherAlert_idempotencyKey_key" ON public."TeacherAlert" USING btree ("idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`
- `curriculum_content_fts` on `CurriculumContent`: `CREATE INDEX curriculum_content_fts ON public."CurriculumContent" USING gin (to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(subject, ''::text))))`
- `school_event_fts` on `SchoolEvent`: `CREATE INDEX school_event_fts ON public."SchoolEvent" USING gin (to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text))))`
- `curriculum_content_embedding_idx` on `CurriculumContent`: `CREATE INDEX curriculum_content_embedding_idx ON public."CurriculumContent" USING ivfflat (embedding vector_cosine_ops) WITH (lists='100')`
- `rag_chunk_embedding_idx` on `RagChunk`: `CREATE INDEX rag_chunk_embedding_idx ON public."RagChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists='100')`

A schema-only baseline must exclude all rows, users, student/guardian data, auth data, secrets, and provider credentials.

## Data and seed audit

Seven pre-P2-A migrations contain application-data DML:

| Migration | Classification | Recommended destination |
| --- | --- | --- |
| `20260224_000000_seed_training_modules` | Essential Training Center reference data, intended idempotent but coupled to the wrong schema | Explicit idempotent post-baseline reference seed |
| `20260228_civics_strands` | Essential MOE/mastery reference taxonomy, idempotent on natural key | Versioned reference-data seed |
| `20260228_math_strands` | Essential MOE/mastery reference taxonomy, idempotent on natural key | Versioned reference-data seed |
| `20260302_engineering_cs_standards` | Essential MOE standards, upsert-style data correction | Versioned reference-data seed |
| `20260410_000000_phase2_subject_reconciliation` | Historical production backfill and destructive column reconciliation | Legacy data patch only; final schema in baseline, never replay on empty data |
| `20260428_000000_curriculum_year_mapping` | Historical data backfill | Legacy data patch only; omit from clean bootstrap |
| `20260516_000002_sprint21_video_microlessons` | Historical status backfill | Legacy data patch only; omit from clean bootstrap |

Demo, CHA, placement-demo, load-test, press/VSL, sample curriculum, and synthetic P2-A fixtures must remain explicit environment-scoped tools. They do not belong in schema migrations or application startup. Application startup must never seed mutable database state.

## Repair options

### Option A: preserve active history and add a new-environment bootstrap

Keep all historical files byte-for-byte, apply a reviewed schema snapshot to a new database, then use Prisma-supported `migrate resolve --applied` for the legacy names in the new database only.

Advantages: no immediate production ledger mutation; fastest route to staging. Disadvantages: 129 synthetic resolved rows, duplicated bootstrap/migration paths, current checksum divergence remains, and CI must test both legacy and new-environment behavior. This is an acceptable short-term bridge but weak as the permanent architecture.

### Option B: repair historical migrations in place

Convert UTF-16, restore missing migrations/tables, and edit broken SQL.

This is rejected. Production has 128 shared names, four checksum mismatches already, resolved rows, rolled-back retries, and 18 production-only names. Editing history would further invalidate checksum evidence and can make `migrate deploy` behavior environment-dependent.

### Option C: archive legacy history and cut over to a canonical baseline

Move the immutable legacy chain to an audit archive, create one schema-only canonical pre-P2-A baseline, place future migrations after it, apply the baseline normally to new databases, and later mark that one baseline applied in existing production using the documented Prisma baseline workflow.

Advantages: one durable clean-bootstrap path, one production cutover record, straightforward PG17 CI, and preserved legacy evidence. Disadvantages: requires a separately authorized production ledger cutover and careful deployment choreography.

## Recommendation

Adopt Option C as the permanent repair, with Option A allowed only as a time-boxed staging bridge if staging urgency outweighs the cost of a second migration path. Do not repair old files.

The canonical baseline should start from a production schema-only PostgreSQL dump, not from `schema.prisma` alone. Reconcile every catalog difference in a manifest, then add only approved pre-P2-A forward deltas. The repository-only `20260803_000001_privileged_identity_hardening` migration can be applied to a disposable copy and included only after its existing review is reconfirmed. `PolicyConfig`, `PolicyOverride`, Role enum expansion, `InterventionRecommendation.updatedAt`, and any deletion of `TrendSnapshot` require explicit decisions; they must not be silently materialized from Prisma intent.

## Exact implementation plan

1. Freeze and hash all 129 legacy migrations plus the 18 production-only names and the four current checksum mismatches.
2. Obtain a schema-only production dump with PostgreSQL 17 tooling. Exclude data, auth rows, storage rows, owners, credentials, and provider configuration.
3. Restore that dump into disposable PostgreSQL 17 and inventory tables, columns, enums, defaults, indexes, constraints, extensions, triggers, functions, RLS flags, and grants.
4. Apply the reviewed `20260803_000001_privileged_identity_hardening` migration only in the disposable database.
5. Resolve the documented drift decisions: Policy tables, Role enum values, TrendSnapshot, two column differences, enum ordering, defaults, time-zone types, and nullable arrays.
6. Generate a deterministic canonical schema-only baseline and a machine-readable catalog manifest.
7. Restore the baseline into a second empty PostgreSQL 17 instance and require catalog equivalence to the approved manifest.
8. Run explicit idempotent reference seeds separately. Do not run demo or historical backfill data.
9. Archive the legacy chain without byte changes and publish a checksum manifest.
10. Add the canonical baseline as the root of the active Prisma migration chain. Future migrations, including unchanged P2-A files, follow it.
11. In a separately authorized production maintenance operation, verify a backup, run `prisma migrate resolve --applied <canonical-baseline>` once, and immediately prove no schema or row change occurred. This step is not authorized in the present sprint.
12. Build staging from the canonical baseline, load only the two synthetic fixtures, create/restore the PG17 backup, and rerun Gate 0.

## Checksum preservation strategy

- Never change the 129 legacy migration bytes.
- Store SHA-256 for every legacy file, including the current UTF-16 baseline.
- Preserve the production ledger export and its 18 production-only names.
- Store the four repository/production checksum mismatches as known historical drift.
- Hash the canonical baseline, its catalog manifest, reference-seed package, and P2-A files independently.
- Do not use direct SQL inserts into `_prisma_migrations`.
- Any later `migrate resolve` use is a one-time, reviewed baseline cutover with before/after ledger evidence.

## PostgreSQL 17 CI clean-bootstrap gate

1. Launch disposable `postgres:17-alpine` plus the required vector extension capability, or a pinned PG17 image that includes pgvector.
2. Assert `psql`, `pg_dump`, and `pg_restore` major version 17.
3. Apply the canonical baseline to an empty database through the exact operator path.
4. Apply every migration after the baseline.
5. Run `prisma validate`, `prisma generate`, and a schema drift comparison.
6. Compare the live catalog with the committed manifest, including enums/order, defaults, nullability, PK/FK/unique constraints, all 703-equivalent indexes, partial/GIN/IVFFLAT indexes, extensions, functions, triggers, and RLS flags.
7. Optionally apply essential reference seeds twice and prove idempotency.
8. Run application schema smoke tests and confirm no demo/user rows were introduced.
9. Run a custom-format PG17 dump/restore and repeat critical catalog assertions.
10. Destroy the database and fail CI on any mismatch.

## P2-A impact

P2-A schema design does not need to change based on this discovery. Keep A/B1/B2/C byte-for-byte unchanged if the canonical baseline provides their reviewed preconditions. The sequence remains:

1. trusted pre-P2-A canonical baseline;
2. two synthetic curriculum fixtures;
3. PG17 logical backup and disposable restore proof;
4. full Gate 0;
5. separate authorization for P2-A A/B1/B2/C.

P2-A migration hashes must be rechecked after the active-chain cutover even when their files are unchanged.

## Decisions requiring founder/advisor review

1. Approve Option C permanent cutover, or explicitly authorize time-boxed Option A for staging first.
2. Decide whether undeployed `PolicyConfig`, `PolicyOverride`, and Role enum expansion belong in the pre-P2-A boundary.
3. Decide whether production-only `TrendSnapshot` remains supported, is modeled in Prisma, or is deprecated by a future reviewed migration.
4. Authorize the later production baseline ledger marker only after schema-equivalence and backup evidence pass.
