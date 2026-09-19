# /privacy — 라이프(인생 타임라인) 데이터 항목 초안

> PRD §8-2에 따라 `/privacy`(public/privacy.html)에 추가할 문구 **초안**입니다.
> 아직 게시하지 않았습니다. 운영자 검토 뒤 기존 개인정보처리방침의 "처리하는 정보" 부분에
> 한국어·영어로 넣고, 문서 상단의 최종 수정일을 바꿔 주세요.

---

## 한국어

### 라이프(인생 타임라인) 기록

라이프 기능을 쓰면 다음 정보가 만들어집니다.

- **이용자 본인에 관한 정보**: 생년월일(필수), 이름(선택), 기대 수명 설정
- **인생의 사건과 계획**: 날짜, 제목, 설명, 분류, 계획 여부, 사진(Pro)
- **가족 정보(제3자 정보)**: 관계, 이름, 생년월일(선택), 메모(선택), 사진(Pro)
- **남기고 싶은 말**: 이용자가 직접 쓴 글과 마지막 수정 시각

**저장 위치**

- 기본적으로 위 정보는 이용자의 브라우저(해당 기기의 로컬 저장소)에만 저장되며, 회사 서버로 보내지지 않습니다.
- **Pro 동기화**를 켜면 사진을 뺀 라이프 기록이 다른 기록과 함께 회사 서버(Cloudflare D1)에 저장되어 로그인한 기기끼리 동기화됩니다. 일기 잠금(종단간 암호화)을 켠 경우에는 암호화된 상태로 저장되어 회사도 내용을 볼 수 없습니다.
- **사진**은 용량 때문에 사진을 추가한 기기의 브라우저(IndexedDB)에만 저장되며, 동기화되지 않고 서버로 보내지지 않습니다.
- **이미지(PNG) 내보내기**와 **JSON 백업**은 이용자의 기기 안에서 만들어져 이용자가 고른 위치에 저장되며, 서버로 보내지지 않습니다. 이후 이 파일을 누구와 공유할지는 이용자가 정합니다.

**가족 정보에 관하여**

- 가족의 이름·생년월일 등은 이용자가 아닌 제3자의 개인정보입니다. 이용자는 가족의 동의를 받아 기록해야 하며, 특히 Pro 동기화를 켜면 해당 정보가 서버에도 저장된다는 점을 가족에게 알려 주시기 바랍니다.
- 회사는 가족 정보를 이용자의 기록을 보관·동기화하는 목적 외에는 이용하지 않으며, 마케팅이나 분석에 쓰지 않습니다.

**보관과 삭제**

- 기기에 저장된 기록은 이용자가 삭제하거나 브라우저 데이터를 지울 때까지 남아 있습니다.
- 서버에 동기화된 기록은 이용자가 기록을 지우거나 계정 삭제를 요청하면 삭제됩니다. 계정 삭제는 문의 페이지 또는 singlena@gmail.com으로 요청할 수 있습니다.

**"남기고 싶은 말"에 관하여**

- 남기고 싶은 말은 이용자가 가족과 소중한 사람에게 전하려는 글을 적는 공간이며, 법적 효력이 있는 유언장이 아닙니다. 회사는 이 글을 제3자에게 전달하지 않습니다.

---

## English

### Life timeline records

Using the Life feature creates the following information.

- **About you**: your birthday (required), name (optional) and expected life span setting
- **Moments and plans**: date, title, description, category, whether it is a plan, and a photo (Pro)
- **Family members (third-party information)**: relationship, name, birthday (optional), note (optional) and a photo (Pro)
- **Words to leave behind**: the text you write and when you last changed it

**Where it is kept**

- By default all of this is stored only in your browser (local storage on that device) and is not sent to our server.
- With **Pro sync** turned on, your life record — photos excepted — is stored on our server (Cloudflare D1) together with your other records and synced between your signed-in devices. With the diary lock (end-to-end encryption) on, it is stored encrypted and we cannot read it.
- **Photos** stay in the browser (IndexedDB) of the device that added them, because of their size. They are not synced and not sent to our server.
- The **image (PNG) export** and the **JSON backup** are made on your device and saved where you choose; they are not uploaded. Whom you share them with is up to you.

**About family details**

- Family members' names and birthdays are personal information about other people. Please record them with their consent, and let them know that turning on Pro sync also stores them on our server.
- We use family details only to keep and sync your record — never for marketing or analysis.

**Retention and deletion**

- Records on your device remain until you delete them or clear your browser data.
- Synced records are deleted from our server when you delete them or ask us to delete your account (via the Contact page or singlena@gmail.com).

**About "Words to leave behind"**

- The ending note is a place to write what you would like to leave to your family and the people you love. It is not a legally valid will, and we never pass it on to anyone.
